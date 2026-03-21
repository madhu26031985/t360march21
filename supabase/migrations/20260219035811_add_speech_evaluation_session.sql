/*
  # Add Speech Evaluation Session
  
  1. Changes
    - Create new agenda section "Speech Evaluation Session" at position 11.5 (between Keynote Speaker and Timer Report)
    - Duration: 15 minutes (to accommodate multiple speech evaluators, typically 3-4 evaluators × 3-4 minutes each)
    - Role classification: speech_evaluator
    - Shift Timer Report and all subsequent sections down by 1 position
  
  2. Section Details
    - Section Name: "Speech Evaluation Session"
    - Description: "Speech evaluators provide detailed feedback on prepared speeches delivered during the meeting"
    - Duration: 15 minutes (default, can be adjusted based on number of speeches)
    - Role: speech_evaluator
  
  3. New Order
    - Position 11: Keynote Speaker
    - Position 12: Speech Evaluation Session (NEW)
    - Position 13: Timer Report (shifted from 12)
    - Position 14: Ah Counter Report (shifted from 13)
    - Position 15: Grammarian Report (shifted from 14)
    - Position 16: General Evaluator Feedback (shifted from 15)
  
  4. Rationale
    - Evaluations should occur after all speech content (Prepared Speeches, Table Topics, Educational, Keynote)
    - Placing before functional reports (Timer, Ah Counter, Grammarian) follows standard Toastmasters flow
    - This replicates the prepared speech evaluation structure but as a dedicated session
*/

-- First, shift all sections from Timer Report onwards down by 1 in templates
UPDATE agenda_item_templates 
SET section_order = section_order + 1,
    updated_at = now()
WHERE section_order >= 12 AND is_active = true;

-- Create the new Speech Evaluation Session template for all clubs
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
  'Speech Evaluation Session',
  'Speech evaluators provide detailed feedback on prepared speeches delivered during the meeting',
  12,
  15,
  true,
  'speech_evaluator',
  true
FROM agenda_item_templates
WHERE is_active = true
ON CONFLICT DO NOTHING;

-- Add this section to all existing meetings
-- First shift existing sections from Timer Report onwards down by 1
UPDATE meeting_agenda_items 
SET section_order = section_order + 1,
    updated_at = now()
WHERE section_order >= 12;

-- Then insert the new section for all meetings
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
  'Speech Evaluation Session',
  'Speech evaluators provide detailed feedback on prepared speeches delivered during the meeting',
  12,
  15,
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
  AND mai.section_name = 'Speech Evaluation Session'
);
