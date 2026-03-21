/*
  # Fix Missing Agenda Sections in Meetings (v2)
  
  1. Problem
    - Speech Evaluation Session and General Evaluator Feedback sections exist in templates
    - But they were never added to existing meetings
    - Timer/Ah Counter/Grammarian Reports are at wrong positions (17, 18, 19 instead of 13, 14, 15)
  
  2. Solution
    - First, fix the section_order for Timer, Ah Counter, and Grammarian Reports
    - Then add Speech Evaluation Session (position 12)
    - Then add General Evaluator Feedback (position 16)
  
  3. Steps
    - Update Timer Report from 17 to 13
    - Update Ah Counter Report from 18 to 14
    - Update Grammarian Report from 19 to 15
    - Insert Speech Evaluation Session at position 12
    - Insert General Evaluator Feedback at position 16
*/

-- Step 1: Fix section_order for existing reports
UPDATE meeting_agenda_items 
SET section_order = 13, updated_at = now()
WHERE section_name = 'Timer Report' AND section_order = 17;

UPDATE meeting_agenda_items 
SET section_order = 14, updated_at = now()
WHERE section_name = 'Ah Counter Report' AND section_order = 18;

UPDATE meeting_agenda_items 
SET section_order = 15, updated_at = now()
WHERE section_name = 'Grammarian Report' AND section_order = 19;

-- Step 2: Insert Speech Evaluation Session for all meetings that don't have it
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
SELECT DISTINCT
  m.id,
  m.club_id,
  'Speech Evaluation Session',
  'Speech evaluators provide detailed feedback on prepared speeches delivered during the meeting',
  12,
  15,
  true,
  true
FROM app_club_meeting m
WHERE NOT EXISTS (
  SELECT 1 FROM meeting_agenda_items mai
  WHERE mai.meeting_id = m.id 
  AND mai.section_name = 'Speech Evaluation Session'
);

-- Step 3: Insert General Evaluator Feedback for all meetings that don't have it
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
SELECT DISTINCT
  m.id,
  m.club_id,
  'General Evaluator Feedback',
  'General Evaluator provides feedback and overall evaluation',
  16,
  3,
  true,
  true
FROM app_club_meeting m
WHERE NOT EXISTS (
  SELECT 1 FROM meeting_agenda_items mai
  WHERE mai.meeting_id = m.id 
  AND mai.section_name = 'General Evaluator Feedback'
);
