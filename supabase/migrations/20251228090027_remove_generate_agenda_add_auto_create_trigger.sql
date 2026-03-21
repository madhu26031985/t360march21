/*
  # Remove Generate Agenda Function and Auto-Create All Sections on Meeting Creation

  ## Summary
  This migration removes the auto_generate_meeting_agenda function and replaces it with a trigger
  that automatically creates all 15 standard agenda sections when a new meeting is created.
  All sections are created as hidden by default, and ExComm can control visibility.

  ## Changes
  
  1. Drop auto_generate_meeting_agenda function
    - Removes the manual/regenerate agenda functionality
    
  2. Create trigger function
    - Automatically creates all 15 agenda sections when a meeting is created
    - All sections start as hidden (is_visible = false)
    - ExComm can toggle visibility as needed
    
  3. Default values
    - is_visible = false (all sections hidden by default)
    - is_auto_generated = true
    - Times are set to NULL initially (ExComm calculates them)
    
  ## Security
    - No RLS changes needed (inherits from existing policies)
*/

-- Drop the old auto_generate_meeting_agenda function
DROP FUNCTION IF EXISTS auto_generate_meeting_agenda(UUID);

-- Create function to auto-create all agenda sections on meeting creation
CREATE OR REPLACE FUNCTION auto_create_meeting_agenda_sections()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_section_order INTEGER := 0;
  v_template RECORD;
BEGIN
  -- Loop through all agenda templates and create sections for this meeting
  FOR v_template IN 
    SELECT * FROM agenda_item_templates
    WHERE (club_id = NEW.club_id OR club_id IS NULL)
      AND is_active = true
    ORDER BY section_order
  LOOP
    v_section_order := v_section_order + 1;
    
    -- Insert agenda item for this template
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
      NEW.id,
      NEW.club_id,
      v_template.id,
      v_template.section_name,
      v_template.section_description,
      v_template.section_icon,
      v_section_order,
      NULL, -- Times are calculated by ExComm in the editor
      NULL,
      COALESCE(v_template.default_duration_minutes, 5),
      true,
      false -- All sections hidden by default
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run after meeting insert
DROP TRIGGER IF EXISTS trigger_auto_create_agenda_sections ON app_club_meeting;
CREATE TRIGGER trigger_auto_create_agenda_sections
  AFTER INSERT ON app_club_meeting
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_meeting_agenda_sections();

-- Add comment
COMMENT ON FUNCTION auto_create_meeting_agenda_sections IS 
  'Automatically creates all 15 standard agenda sections (hidden by default) when a new meeting is created. ExComm can then toggle visibility and manage sections.';
