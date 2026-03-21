/*
  # Add General Evaluator Feedback Section
  
  1. Changes
    - Create new agenda section "General Evaluator Feedback" at position 15
    - Duration: 3 minutes
    - Role classification: general_evaluator
    - Shift all subsequent sections down by 1 position
  
  2. Impact
    - New section appears after Grammarian Report
    - Break and all following sections shift down by 1
  
  3. New Order
    - Position 14: Grammarian Report
    - Position 15: General Evaluator Feedback (NEW)
    - Position 16: Break (shifted from 15)
*/

-- First, shift all sections after Grammarian Report down by 1 in templates
UPDATE agenda_item_templates 
SET section_order = section_order + 1,
    updated_at = now()
WHERE section_order >= 15 AND is_active = true;

-- Create the new General Evaluator Feedback template for all clubs
INSERT INTO agenda_item_templates (
  club_id,
  section_name,
  section_description,
  section_order,
  default_duration_minutes,
  is_role_based,
  role_classification,
  is_active
)
SELECT DISTINCT
  club_id,
  'General Evaluator Feedback',
  'General Evaluator provides feedback and overall evaluation',
  15,
  3,
  true,
  'general_evaluator',
  true
FROM agenda_item_templates
WHERE is_active = true
ON CONFLICT DO NOTHING;

-- Add this section to all existing meetings
-- First shift existing sections down
UPDATE meeting_agenda_items 
SET section_order = section_order + 1,
    updated_at = now()
WHERE section_order >= 15;

-- Then insert the new section for all meetings using the correct meetings table
INSERT INTO meeting_agenda_items (
  meeting_id,
  club_id,
  section_name,
  section_description,
  section_order,
  duration_minutes,
  is_visible,
  is_auto_generated
)
SELECT 
  m.id,
  m.club_id,
  'General Evaluator Feedback',
  'General Evaluator provides feedback and overall evaluation',
  15,
  3,
  true,
  true
FROM meetings m
WHERE m.id IN (
  SELECT DISTINCT meeting_id 
  FROM meeting_agenda_items
)
AND NOT EXISTS (
  SELECT 1 FROM meeting_agenda_items mai
  WHERE mai.meeting_id = m.id 
  AND mai.section_name = 'General Evaluator Feedback'
);
