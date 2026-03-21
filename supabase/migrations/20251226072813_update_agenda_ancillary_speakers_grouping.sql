/*
  # Update Ancillary Speakers Grouping Logic
  
  ## Summary
  Modifies the auto_generate_meeting_agenda function to create a SINGLE Ancillary Speakers
  agenda item that aggregates all ancillary roles (Timer, Ah-Counter, Grammarian, Quizmaster)
  instead of creating separate items for each role.
  
  ## Changes
  1. Update the agenda generation function to aggregate ancillary roles
  2. Store all ancillary roles in a single agenda item with role_details as a JSON array
  
  ## Security
    - No RLS changes needed
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
  v_ancillary_roles JSONB := '[]'::JSONB;
  v_has_ancillary_roles BOOLEAN := false;
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
      
      -- Special handling for Ancillary Speakers - aggregate all roles into one item
      IF v_template.role_classification = 'ancillary_speakers' THEN
        v_ancillary_roles := '[]'::JSONB;
        v_has_ancillary_roles := false;
        
        -- Collect all ancillary roles into a JSON array
        FOR v_role IN
          SELECT 
            rm.id as role_management_id,
            rm.role_name,
            rm.assigned_user_id,
            rm.role_classification,
            u.full_name as user_name,
            u.avatar_url as user_avatar
          FROM app_meeting_roles_management rm
          LEFT JOIN app_user_profiles u ON rm.assigned_user_id = u.id
          WHERE rm.meeting_id = p_meeting_id
            AND rm.club_id = v_club_id
            AND rm.role_classification IN ('timer', 'ah_counter', 'grammarian', 'quiz_master')
          ORDER BY 
            CASE rm.role_classification
              WHEN 'timer' THEN 1
              WHEN 'ah_counter' THEN 2
              WHEN 'grammarian' THEN 3
              WHEN 'quiz_master' THEN 4
              ELSE 5
            END,
            rm.role_indexing
        LOOP
          v_has_ancillary_roles := true;
          v_ancillary_roles := v_ancillary_roles || jsonb_build_object(
            'role_id', v_role.role_management_id,
            'role_name', v_role.role_name,
            'role_classification', v_role.role_classification,
            'assigned_user_id', v_role.assigned_user_id,
            'assigned_user_name', COALESCE(v_role.user_name, 'TBA'),
            'assigned_user_avatar', v_role.user_avatar
          );
        END LOOP;
        
        -- Create a single Ancillary Speakers agenda item with all roles
        IF v_has_ancillary_roles THEN
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
            jsonb_build_object('ancillary_roles', v_ancillary_roles),
            true
          );
          
          v_items_created := v_items_created + 1;
          v_current_time := v_current_time + (COALESCE(v_template.default_duration_minutes, 5) || ' minutes')::INTERVAL;
        END IF;
        
      ELSE
        -- Regular role-based sections (not ancillary)
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
              (v_template.role_classification = 'table_topics_master' AND rm.role_classification = 'table_topics_master') OR
              (v_template.role_classification = 'general_evaluator' AND rm.role_classification = 'general_evaluator') OR
              (v_template.role_classification = 'toastmaster_of_the_day' AND rm.role_classification = 'toastmaster_of_the_day') OR
              (v_template.role_classification = 'sergeant_at_arms' AND rm.role_classification = 'sergeant_at_arms') OR
              (v_template.role_classification = 'presiding_officer' AND rm.role_classification = 'presiding_officer') OR
              (v_template.role_classification = 'educational_speaker' AND rm.role_classification = 'educational_speaker') OR
              (v_template.role_classification = 'evaluation' AND rm.role_classification IN ('evaluator')) OR
              (v_template.role_classification = 'voting_coordinator' AND rm.role_classification IN ('voting_coordinator', 'toastmaster_of_the_day'))
            )
          ORDER BY rm.role_indexing, rm.created_at
        LOOP
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

-- Add comment
COMMENT ON FUNCTION auto_generate_meeting_agenda IS 
  'Auto-generates meeting agenda items based on templates and booked roles. Ancillary Speakers section aggregates all Tag Team and Listener roles into a single agenda item.';