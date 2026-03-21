/*
  # Backfill Daily Highlights Section to Existing Meetings
  
  1. Purpose
    - Add the new "Daily Highlights" section to all existing meetings
    - Insert it at section order 7 (after Tag Team Introduction)
  
  2. Changes
    - For each existing meeting, insert the Daily Highlights section
    - Set it as hidden by default (is_visible = false)
    - Adjust section_order of subsequent sections
  
  3. Notes
    - Only adds to meetings that don't already have this section
    - Maintains existing section ordering
*/

DO $$
DECLARE
  v_meeting RECORD;
  v_template_id UUID;
  v_club_id UUID;
BEGIN
  -- Get the Daily Highlights template ID
  SELECT id INTO v_template_id
  FROM agenda_item_templates
  WHERE section_name = 'Daily Highlights'
  LIMIT 1;
  
  -- Loop through all meetings
  FOR v_meeting IN 
    SELECT DISTINCT meeting_id, club_id 
    FROM meeting_agenda_items
  LOOP
    -- Check if this meeting already has Daily Highlights section
    IF NOT EXISTS (
      SELECT 1 FROM meeting_agenda_items
      WHERE meeting_id = v_meeting.meeting_id
      AND section_name = 'Daily Highlights'
    ) THEN
      -- Shift sections after order 6 up by 1
      UPDATE meeting_agenda_items
      SET section_order = section_order + 1
      WHERE meeting_id = v_meeting.meeting_id
      AND section_order >= 7;
      
      -- Insert Daily Highlights section at order 7
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
        v_meeting.meeting_id,
        v_meeting.club_id,
        v_template_id,
        'Daily Highlights',
        'Word of the Day, Idiom of the Day, and Quote of the Day from the Grammarian',
        '✨',
        7,
        NULL,
        NULL,
        5,
        true,
        false
      );
    END IF;
  END LOOP;
END $$;
