/*
  # Fix Agenda Item Trigger - Club ID Mismatch

  ## Summary
  Fixes the auto_create_meeting_agenda_sections trigger to correctly handle the difference
  between clubs.id and club_profiles.id when creating agenda items.

  ## Issue
  - app_club_meeting.club_id references clubs.id
  - meeting_agenda_items.club_id references club_profiles.id (different table!)
  - Trigger was trying to use clubs.id where club_profiles.id was expected

  ## Solution
  Update the trigger to look up club_profiles.id using the clubs.id from the meeting

  ## Security
  - No RLS changes needed
*/

-- Replace the trigger function to fix club_id lookup
CREATE OR REPLACE FUNCTION auto_create_meeting_agenda_sections()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_section_order INTEGER := 0;
  v_template RECORD;
  v_club_profile_id UUID;
BEGIN
  -- Get the club_profiles.id for this club
  SELECT id INTO v_club_profile_id
  FROM club_profiles
  WHERE club_id = NEW.club_id;
  
  -- If no club profile found, skip agenda creation
  IF v_club_profile_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Loop through all agenda templates and create sections for this meeting
  FOR v_template IN 
    SELECT * FROM agenda_item_templates
    WHERE (club_id = v_club_profile_id OR club_id IS NULL)
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
      v_club_profile_id,  -- Use club_profiles.id, not clubs.id
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
  'Automatically creates all standard agenda sections (hidden by default) when a new meeting is created. Correctly handles the difference between clubs.id and club_profiles.id.';
