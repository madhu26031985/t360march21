/*
  # Add Ancillary Speakers Section to Agenda
  
  ## Summary
  Adds a new "Ancillary Speakers" section to the meeting agenda between
  Table Topics Session and Educational Speaker.
  
  ## Changes
  1. Shift sections with order >= 7 up by 1
  2. Insert new "Ancillary Speakers" section at order 7
  
  ## Section Details
  - Name: Ancillary Speakers
  - Description: Tag Team (Timer, Ah-Counter, Grammarian) and Listener roles
  - Icon: 📢
  - Order: 7 (after Table Topics Session)
  - Duration: 5 minutes
  - Role classification: ancillary_speakers
  
  ## Security
    - No RLS changes needed
*/

-- Shift all sections with order >= 7 up by 1 to make room
UPDATE agenda_item_templates
SET section_order = section_order + 1
WHERE section_order >= 7 AND club_id IS NULL;

-- Insert the new Ancillary Speakers section (only if it doesn't exist)
INSERT INTO agenda_item_templates (
  section_name, 
  section_description, 
  section_icon, 
  section_order, 
  default_duration_minutes, 
  is_role_based, 
  role_classification
)
SELECT 
  'Ancillary Speakers',
  'Tag Team (Timer, Ah-Counter, Grammarian) and Listener roles',
  '📢',
  7,
  5,
  true,
  'ancillary_speakers'
WHERE NOT EXISTS (
  SELECT 1 FROM agenda_item_templates 
  WHERE section_name = 'Ancillary Speakers' AND club_id IS NULL
);