/*
  # Backdate Agenda Sections for Existing Meetings (v2)

  ## Summary
  Creates all 15 standard agenda sections for existing meetings that don't have them yet.
  All sections are created as hidden by default. Only processes meetings with valid club references.

  ## Changes
  
  1. For each existing meeting without agenda sections (with valid club_id)
    - Create all 15 standard agenda sections
    - Set is_visible = false (hidden by default)
    - Use default durations from templates
    
  ## Security
    - No RLS changes needed
*/

-- Create agenda sections for existing meetings that don't have them
DO $$
DECLARE
  v_meeting RECORD;
  v_template RECORD;
  v_section_order INTEGER;
BEGIN
  -- Loop through all meetings with valid club references
  FOR v_meeting IN 
    SELECT DISTINCT m.id, m.club_id
    FROM app_club_meeting m
    INNER JOIN club_profiles cp ON m.club_id = cp.id
    WHERE NOT EXISTS (
      SELECT 1 FROM meeting_agenda_items 
      WHERE meeting_id = m.id
    )
  LOOP
    v_section_order := 0;
    
    -- Create all agenda sections for this meeting
    FOR v_template IN 
      SELECT * FROM agenda_item_templates
      WHERE (club_id = v_meeting.club_id OR club_id IS NULL)
        AND is_active = true
      ORDER BY section_order
    LOOP
      v_section_order := v_section_order + 1;
      
      -- Insert agenda item
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
        is_auto_generated,
        is_visible
      ) VALUES (
        v_meeting.id,
        v_meeting.club_id,
        v_template.id,
        v_template.section_name,
        v_template.section_description,
        v_template.section_icon,
        v_section_order,
        NULL,
        NULL,
        COALESCE(v_template.default_duration_minutes, 5),
        true,
        false -- All sections hidden by default
      );
    END LOOP;
    
    RAISE NOTICE 'Created agenda sections for meeting %', v_meeting.id;
  END LOOP;
END;
$$;
