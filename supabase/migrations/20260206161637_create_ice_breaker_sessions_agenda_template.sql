/*
  # Create Ice Breaker Sessions Agenda Template

  1. New Templates
    - Add "Ice Breaker Sessions" as a new agenda section template
    - Similar to Prepared Speeches Session but for Ice Breaker speeches
    - Positioned after Prepared Speeches Session (section_order 7 to fit between existing sections)

  2. Updates
    - Adds template for clubs to display Ice Breaker Speaker 1-5 details
    - Auto-generated based on meeting role bookings
*/

-- Insert Ice Breaker Sessions template
INSERT INTO agenda_item_templates (
  section_name,
  section_description,
  section_icon,
  section_order,
  default_duration_minutes,
  is_role_based,
  is_active,
  club_id
)
SELECT
  'Ice Breaker Sessions',
  'New members deliver their first speeches (4-6 minutes each)',
  '🎤',
  7,
  25,
  true,
  true,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM agenda_item_templates 
  WHERE section_name = 'Ice Breaker Sessions' AND club_id IS NULL
);

-- Reorder existing sections: bump Table Topics and everything after by 1
UPDATE agenda_item_templates
SET section_order = section_order + 1
WHERE section_order >= 7
AND section_name != 'Ice Breaker Sessions';

-- Add Ice Breaker Sessions to all existing meetings that don't have it
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
SELECT
  m.id,
  m.club_id,
  'Ice Breaker Sessions',
  'New members deliver their first speeches (4-6 minutes each)',
  '🎤',
  7,
  25,
  true,
  true
FROM app_club_meeting m
WHERE NOT EXISTS (
  SELECT 1 FROM meeting_agenda_items mai
  WHERE mai.meeting_id = m.id
  AND mai.section_name = 'Ice Breaker Sessions'
);

-- Reorder existing meeting agenda items to make room for Ice Breaker Sessions
UPDATE meeting_agenda_items
SET section_order = section_order + 1
WHERE section_order >= 7
AND section_name != 'Ice Breaker Sessions';