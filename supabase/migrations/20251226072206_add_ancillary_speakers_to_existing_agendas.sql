/*
  # Add Ancillary Speakers to Existing Meeting Agendas
  
  ## Summary
  Updates existing meeting agendas to include the new Ancillary Speakers section
  at the correct position (order 7).
  
  ## Changes
  1. Shift all sections with order >= 7 up by 1 in existing meetings
  2. Insert Ancillary Speakers section for each meeting
  
  ## Security
    - No RLS changes needed
*/

-- Shift all sections with order >= 7 up by 1 in existing meetings
UPDATE meeting_agenda_items
SET section_order = section_order + 1
WHERE section_order >= 7;

-- Insert Ancillary Speakers section for each meeting (auto-generated)
INSERT INTO meeting_agenda_items (
  meeting_id,
  club_id,
  section_name,
  section_description,
  section_icon,
  section_order,
  duration_minutes,
  is_auto_generated,
  is_visible
)
SELECT DISTINCT
  mai.meeting_id,
  mai.club_id,
  'Ancillary Speakers',
  'Tag Team (Timer, Ah-Counter, Grammarian) and Listener roles',
  '📢',
  7,
  5,
  true,
  true
FROM meeting_agenda_items mai
WHERE NOT EXISTS (
  SELECT 1 FROM meeting_agenda_items mai2
  WHERE mai2.meeting_id = mai.meeting_id 
  AND mai2.section_name = 'Ancillary Speakers'
);