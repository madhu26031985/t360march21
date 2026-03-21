/*
  # Fix Agenda Generation to Show All Sections
  
  ## Summary
  Updates the auto_generate_meeting_agenda function to always create all 10 agenda sections
  even when roles are not yet booked. Previously, role-based sections were skipped if no
  matching roles were found, resulting in incomplete agendas.
  
  ## Changes
  - Modified function logic to always create sections from templates
  - For role-based sections without assignments, shows "TBA" (To Be Announced)
  - For role-based sections with multiple roles (e.g., prepared speakers), creates
    a placeholder section if no roles are booked
  - Ensures complete 10-section agenda structure on every generation
  
  ## Affected Sections
  All 10 standard Toastmasters meeting sections are now guaranteed to appear:
  1. Meet and Greet
  2. Call to Order (SAA)
  3. Presiding Officer Address
  4. Toastmaster of the Day
  5. Prepared Speeches Session
  6. Table Topics Session
  7. Evaluation Session
  8. General Evaluator Report
  9. Voting
  10. Awards and Closing
*/

CREATE OR REPLACE FUNCTION auto_generate_meeting_agenda(p_meeting_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  items_created INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_club_id UUID;
  v_meeting_start_time TIME;
  v_current_time TIME;
  v_items_created INTEGER := 0;
  v_section_order INTEGER := 0;
  v_template RECORD;
  v_role RECORD;
  v_role_found BOOLEAN;
BEGIN
  -- Get meeting details
  SELECT club_id, meeting_start_time INTO v_club_id, v_meeting_start_time
  FROM app_club_meeting
  WHERE id = p_meeting_id;

  IF v_club_id IS NULL THEN
    RETURN QUERY SELECT false, 'Meeting not found'::TEXT, 0;
    RETURN;
  END IF;

  -- Default start time if not set
  IF v_meeting_start_time IS NULL THEN
    v_meeting_start_time := '16:00:00'::TIME;
  END IF;

  v_current_time := v_meeting_start_time;

  -- Delete existing auto-generated agenda items
  DELETE FROM meeting_agenda_items
  WHERE meeting_id = p_meeting_id AND is_auto_generated = true;

  -- Loop through agenda templates
  FOR v_template IN 
    SELECT * FROM agenda_item_templates
    WHERE (club_id = v_club_id OR club_id IS NULL)
      AND is_active = true
    ORDER BY section_order
  LOOP
    v_section_order := v_section_order + 1;

    IF v_template.is_role_based AND v_template.role_classification IS NOT NULL THEN
      v_role_found := false;
      
      -- Get all roles matching this classification
      FOR v_role IN
        SELECT 
          rm.id as role_management_id,
          rm.role_name,
          rm.assigned_user_id,
          rm.speech_title,
          rm.pathway_name,
          rm.pathway_level,
          rm.project_title,
          rm.table_topic_question,
          rm.role_classification,
          u.full_name as user_name
        FROM app_meeting_roles_management rm
        LEFT JOIN app_user_profiles u ON rm.assigned_user_id = u.id
        WHERE rm.meeting_id = p_meeting_id
          AND rm.club_id = v_club_id
          AND (
            (v_template.role_classification = 'prepared_speaker' AND rm.role_classification = 'prepared_speaker') OR
            (v_template.role_classification = 'evaluation' AND rm.role_classification IN ('evaluator', 'timer', 'ah_counter', 'grammarian', 'quiz_master')) OR
            (v_template.role_classification = 'table_topics_master' AND rm.role_classification = 'table_topics_master') OR
            (v_template.role_classification = 'general_evaluator' AND rm.role_classification = 'general_evaluator') OR
            (v_template.role_classification = 'toastmaster_of_the_day' AND rm.role_classification = 'toastmaster_of_the_day') OR
            (v_template.role_classification = 'sergeant_at_arms' AND rm.role_classification = 'sergeant_at_arms') OR
            (v_template.role_classification = 'presiding_officer' AND rm.role_classification = 'presiding_officer') OR
            (v_template.role_classification = 'voting_coordinator' AND rm.role_classification IN ('voting_coordinator', 'toastmaster_of_the_day'))
          )
        ORDER BY rm.role_indexing, rm.created_at
      LOOP
        v_role_found := true;
        
        -- Build role details JSON and insert
        INSERT INTO meeting_agenda_items (
          meeting_id,
          club_id,
          template_id,
          section_name,
          section_description,
          section_icon,
          section_order,
          start_time,
          end_time,
          duration_minutes,
          assigned_role_id,
          assigned_user_id,
          assigned_user_name,
          role_details,
          is_auto_generated
        ) VALUES (
          p_meeting_id,
          v_club_id,
          v_template.id,
          v_template.section_name,
          v_template.section_description,
          v_template.section_icon,
          v_section_order,
          v_current_time,
          v_current_time + (COALESCE(v_template.default_duration_minutes, 5) || ' minutes')::INTERVAL,
          COALESCE(v_template.default_duration_minutes, 5),
          v_role.role_management_id,
          v_role.assigned_user_id,
          COALESCE(v_role.user_name, 'TBA'),
          jsonb_build_object(
            'role_name', v_role.role_name,
            'speech_title', v_role.speech_title,
            'pathway_name', v_role.pathway_name,
            'pathway_level', v_role.pathway_level,
            'project_title', v_role.project_title,
            'table_topic_question', v_role.table_topic_question,
            'role_classification', v_role.role_classification
          ),
          true
        );

        v_items_created := v_items_created + 1;
      END LOOP;

      -- If no roles were found, still create a placeholder section
      IF NOT v_role_found THEN
        INSERT INTO meeting_agenda_items (
          meeting_id,
          club_id,
          template_id,
          section_name,
          section_description,
          section_icon,
          section_order,
          start_time,
          end_time,
          duration_minutes,
          assigned_user_name,
          is_auto_generated
        ) VALUES (
          p_meeting_id,
          v_club_id,
          v_template.id,
          v_template.section_name,
          v_template.section_description,
          v_template.section_icon,
          v_section_order,
          v_current_time,
          v_current_time + (COALESCE(v_template.default_duration_minutes, 5) || ' minutes')::INTERVAL,
          COALESCE(v_template.default_duration_minutes, 5),
          'TBA',
          true
        );

        v_items_created := v_items_created + 1;
      END IF;

      -- Update current time
      v_current_time := v_current_time + (COALESCE(v_template.default_duration_minutes, 5) || ' minutes')::INTERVAL;

    ELSE
      -- Non-role-based section (like Meet & Greet)
      INSERT INTO meeting_agenda_items (
        meeting_id,
        club_id,
        template_id,
        section_name,
        section_description,
        section_icon,
        section_order,
        start_time,
        end_time,
        duration_minutes,
        is_auto_generated
      ) VALUES (
        p_meeting_id,
        v_club_id,
        v_template.id,
        v_template.section_name,
        v_template.section_description,
        v_template.section_icon,
        v_section_order,
        v_current_time,
        v_current_time + (COALESCE(v_template.default_duration_minutes, 5) || ' minutes')::INTERVAL,
        COALESCE(v_template.default_duration_minutes, 5),
        true
      );

      v_items_created := v_items_created + 1;
      v_current_time := v_current_time + (COALESCE(v_template.default_duration_minutes, 5) || ' minutes')::INTERVAL;
    END IF;

  END LOOP;

  RETURN QUERY SELECT true, 'Agenda generated successfully'::TEXT, v_items_created;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION auto_generate_meeting_agenda(UUID) TO authenticated;
