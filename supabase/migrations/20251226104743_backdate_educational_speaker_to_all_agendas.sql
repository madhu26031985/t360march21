/*
  # Backdate Educational Speaker Section to All Meeting Agendas

  ## Summary
  Adds the Educational Speaker section to all existing meeting agendas that don't have it.
  This ensures consistency across all meetings with the new template structure.

  ## Changes
  1. For each meeting that has agenda items:
     - Shift sections with order >= 8 up by 1
     - Insert Educational Speaker section at order 8
  
  2. Section Details
     - Section name: Educational Speaker
     - Section order: 8 (between Ancillary Speakers and General Evaluator Report)
     - Duration: 10 minutes
     - Role-based: true
     - Role classification: educational_speaker
     - Icon: 📚

  ## Notes
  - Only adds to meetings that don't already have this section
  - Preserves all existing section data and times
  - Auto-generated flag set to true
*/

DO $$
DECLARE
  meeting_record RECORD;
  template_record RECORD;
BEGIN
  -- Get the Educational Speaker template
  SELECT * INTO template_record
  FROM agenda_item_templates
  WHERE section_name = 'Educational Speaker'
  AND club_id IS NULL
  LIMIT 1;

  -- If template doesn't exist, exit
  IF NOT FOUND THEN
    RAISE NOTICE 'Educational Speaker template not found, skipping migration';
    RETURN;
  END IF;

  -- Loop through each meeting that has agenda items
  FOR meeting_record IN 
    SELECT DISTINCT meeting_id, club_id
    FROM meeting_agenda_items
  LOOP
    -- Check if this meeting already has an Educational Speaker section
    IF NOT EXISTS (
      SELECT 1 FROM meeting_agenda_items
      WHERE meeting_id = meeting_record.meeting_id
      AND section_name = 'Educational Speaker'
    ) THEN
      
      -- Shift all sections with order >= 8 up by 1
      UPDATE meeting_agenda_items
      SET section_order = section_order + 1
      WHERE meeting_id = meeting_record.meeting_id
      AND section_order >= 8;

      -- Insert the Educational Speaker section
      INSERT INTO meeting_agenda_items (
        meeting_id,
        club_id,
        template_id,
        section_name,
        section_description,
        section_icon,
        section_order,
        duration_minutes,
        is_visible,
        is_auto_generated,
        role_details
      ) VALUES (
        meeting_record.meeting_id,
        meeting_record.club_id,
        template_record.id,
        template_record.section_name,
        template_record.section_description,
        template_record.section_icon,
        8,
        template_record.default_duration_minutes,
        true,
        true,
        jsonb_build_object('role_classification', 'educational_speaker')
      );

      RAISE NOTICE 'Added Educational Speaker section to meeting %', meeting_record.meeting_id;
    END IF;
  END LOOP;

END $$;
