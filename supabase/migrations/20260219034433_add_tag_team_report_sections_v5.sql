/*
  # Add TAG Team Report Sections to Meeting Agenda
  
  1. New Sections
    - Timer Report (2 minutes)
    - Ah Counter Report (2 minutes)
    - Grammarian Report (2 minutes)
  
  2. Changes
    - Add three new agenda item templates after General Evaluator opening
    - Each section has 2 minutes duration
    - Has "Assigned to" field (linked to meeting role)
    - Shift existing sections down by 3 positions
  
  3. Position
    - These reports come after General Evaluator opening (position 5)
    - Before Tag Team section (now position 9)
  
  4. Description
    - Timer presents timing report
    - Ah Counter presents filler word counts
    - Grammarian shares word usage and grammar observations
*/

-- First, shift all sections after General Evaluator opening (position 6+) down by 3 positions in templates
UPDATE agenda_item_templates 
SET section_order = section_order + 3,
    updated_at = now()
WHERE section_order >= 6 AND is_active = true;

-- Insert Timer Report section (position 6)
INSERT INTO agenda_item_templates (
  id,
  section_name,
  section_order,
  section_description,
  default_duration_minutes,
  section_icon,
  is_role_based,
  role_classification,
  is_active,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Timer Report',
  6,
  'Timer will present the timer report with time tracking for all speakers',
  2,
  '⏱️',
  true,
  'Timer',
  true,
  now(),
  now()
);

-- Insert Ah Counter Report section (position 7)
INSERT INTO agenda_item_templates (
  id,
  section_name,
  section_order,
  section_description,
  default_duration_minutes,
  section_icon,
  is_role_based,
  role_classification,
  is_active,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Ah Counter Report',
  7,
  'Ah Counter will present the ah counter report with filler word counts',
  2,
  '📊',
  true,
  'Ah Counter',
  true,
  now(),
  now()
);

-- Insert Grammarian Report section (position 8)
INSERT INTO agenda_item_templates (
  id,
  section_name,
  section_order,
  section_description,
  default_duration_minutes,
  section_icon,
  is_role_based,
  role_classification,
  is_active,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Grammarian Report',
  8,
  'Grammarian will share grammarian report with word usage and grammar observations',
  2,
  '📝',
  true,
  'Grammarian',
  true,
  now(),
  now()
);

-- Now add these sections to all existing meetings
-- First shift existing meeting sections
UPDATE meeting_agenda_items 
SET section_order = section_order + 3,
    updated_at = now()
WHERE section_order >= 6;

-- Add Timer Report to existing meetings
INSERT INTO meeting_agenda_items (
  id,
  meeting_id,
  club_id,
  section_name,
  section_order,
  section_description,
  duration_minutes,
  section_icon,
  is_visible,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  m.id,
  m.club_id,
  'Timer Report',
  6,
  'Timer will present the timer report with time tracking for all speakers',
  2,
  '⏱️',
  true,
  now(),
  now()
FROM app_club_meeting m
WHERE NOT EXISTS (
  SELECT 1 FROM meeting_agenda_items mai 
  WHERE mai.meeting_id = m.id 
  AND mai.section_name = 'Timer Report'
);

-- Add Ah Counter Report to existing meetings
INSERT INTO meeting_agenda_items (
  id,
  meeting_id,
  club_id,
  section_name,
  section_order,
  section_description,
  duration_minutes,
  section_icon,
  is_visible,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  m.id,
  m.club_id,
  'Ah Counter Report',
  7,
  'Ah Counter will present the ah counter report with filler word counts',
  2,
  '📊',
  true,
  now(),
  now()
FROM app_club_meeting m
WHERE NOT EXISTS (
  SELECT 1 FROM meeting_agenda_items mai 
  WHERE mai.meeting_id = m.id 
  AND mai.section_name = 'Ah Counter Report'
);

-- Add Grammarian Report to existing meetings
INSERT INTO meeting_agenda_items (
  id,
  meeting_id,
  club_id,
  section_name,
  section_order,
  section_description,
  duration_minutes,
  section_icon,
  is_visible,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  m.id,
  m.club_id,
  'Grammarian Report',
  8,
  'Grammarian will share grammarian report with word usage and grammar observations',
  2,
  '📝',
  true,
  now(),
  now()
FROM app_club_meeting m
WHERE NOT EXISTS (
  SELECT 1 FROM meeting_agenda_items mai 
  WHERE mai.meeting_id = m.id 
  AND mai.section_name = 'Grammarian Report'
);
