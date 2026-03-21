/*
  # Add Daily Highlights Section to Agenda
  
  1. Purpose
    - Add a new "Daily Highlights" section after "Tag Team Introduction"
    - This section will display Word of the Day, Idiom of the Day, and Quote of the Day
    - Only displays items that have been entered by the Grammarian
  
  2. Changes
    - Shift all sections after order 6 up by 1 to make room
    - Insert new "Daily Highlights" section at order 7
    - Section is non-role-based and auto-populated from grammarian data
  
  3. Notes
    - Ice Breaker Sessions and Table Topics both had order 8, this also fixes that
    - The section will show whichever daily elements (word/idiom/quote) are entered
*/

-- Step 1: Shift all sections after Tag Team Introduction (order 6) up by 1
UPDATE agenda_item_templates
SET section_order = section_order + 1
WHERE section_order >= 7;

-- Step 2: Insert the new Daily Highlights section at order 7
INSERT INTO agenda_item_templates (
  club_id,
  section_name,
  section_description,
  section_icon,
  section_order,
  default_duration_minutes,
  is_role_based,
  is_active
) VALUES (
  NULL,
  'Daily Highlights',
  'Word of the Day, Idiom of the Day, and Quote of the Day from the Grammarian',
  '✨',
  7,
  5,
  false,
  true
);
