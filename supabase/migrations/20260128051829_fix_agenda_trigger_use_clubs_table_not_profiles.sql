/*
  # Fix Agenda Trigger to Use Clubs Table
  
  ## Summary
  Updates the auto_create_meeting_agenda_sections trigger function to reference
  the clubs table directly instead of looking up club_profiles.id. This fixes
  the foreign key constraint violation when creating meetings.
  
  ## Issue
  - The trigger was trying to use club_profiles.id for meeting_agenda_items.club_id
  - But meeting_agenda_items.club_id now references clubs.id (after migration 20260128011923)
  - This caused foreign key constraint violations when creating meetings
  
  ## Solution
  Update the trigger to use NEW.club_id (clubs.id) directly instead of looking up club_profiles.id
  
  ## Security
  - No RLS changes needed
*/

-- Replace the trigger function to use clubs table IDs directly
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
  -- Note: agenda_item_templates.club_id now references clubs.id (same as NEW.club_id)
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
      NEW.club_id,  -- Use clubs.id directly from the meeting
      v_template.id,
      v_template.section_name,
      v_template.section_description,
      v_template.section_icon,
      v_section_order,
      NULL,
      NULL,
      COALESCE(v_template.default_duration_minutes, 5),
      true,
      false
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_create_meeting_agenda_sections IS 
  'Automatically creates all standard agenda sections (hidden by default) when a new meeting is created. Uses clubs.id consistently across all tables.';
