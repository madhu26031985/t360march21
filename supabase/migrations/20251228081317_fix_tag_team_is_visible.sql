/*
  # Fix Tag Team is_visible in Agenda Generation

  ## Summary
  Updates the auto_generate_meeting_agenda function to ensure Tag Team agenda items
  have is_visible = true so they appear in both the agenda editor and meeting agenda view.

  ## Changes
  - Add is_visible field to Tag Team INSERT statement
  - Set is_visible = true for Tag Team items

  ## Issue
  Tag Team items were being created without is_visible being set, causing them to be
  filtered out in queries that check for is_visible = true.
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
  v_user_name TEXT;
  v_timer_user_id UUID;
  v_ah_counter_user_id UUID;
  v_grammarian_user_id UUID;
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

    -- Special handling for Tag Team
    IF v_template.role_classification = 'tag_team' THEN
      -- Get Timer user
      SELECT assigned_user_id INTO v_timer_user_id
      FROM app_meeting_roles_management
      WHERE meeting_id = p_meeting_id
        AND club_id = v_club_id
        AND role_name = 'Timer'
      LIMIT 1;

      -- Get Ah Counter user
      SELECT assigned_user_id INTO v_ah_counter_user_id
      FROM app_meeting_roles_management
      WHERE meeting_id = p_meeting_id
        AND club_id = v_club_id
        AND role_name = 'Ah Counter'
      LIMIT 1;

      -- Get Grammarian user
      SELECT assigned_user_id INTO v_grammarian_user_id
      FROM app_meeting_roles_management
      WHERE meeting_id = p_meeting_id
        AND club_id = v_club_id
        AND role_name = 'Grammarian'
      LIMIT 1;

      -- Insert Tag Team section with is_visible = true
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
        timer_user_id,
        ah_counter_user_id,
        grammarian_user_id,
        is_visible,
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
        v_timer_user_id,
        v_ah_counter_user_id,
        v_grammarian_user_id,
        true,
        true
      );

      v_items_created := v_items_created + 1;
      v_current_time := v_current_time + (COALESCE(v_template.default_duration_minutes, 5) || ' minutes')::INTERVAL;

    ELSIF v_template.is_role_based AND v_template.role_classification IS NOT NULL THEN
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
        -- Build role details JSON
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

      -- Update current time only if roles were found
      IF v_items_created > 0 THEN
        v_current_time := v_current_time + (COALESCE(v_template.default_duration_minutes, 5) || ' minutes')::INTERVAL;
      END IF;

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
