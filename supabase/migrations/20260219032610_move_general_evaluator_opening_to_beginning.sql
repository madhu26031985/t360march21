/*
  # Move General Evaluator Opening to Beginning of Meeting
  
  1. Changes
    - Move "General Evaluator opening" from position 13 to position 5
    - Shift all sections between positions 5-12 down by one position
    - This places GE opening right after TMOD introduction
  
  2. Rationale
    - Follows standard Toastmasters meeting flow
    - GE is introduced by TMOD early in the meeting
    - GE then observes the entire meeting before giving final report
*/

-- First, move General Evaluator opening to a temporary high position
UPDATE agenda_item_templates 
SET section_order = 999,
    updated_at = now()
WHERE section_name = 'General Evaluator opening';

-- Shift sections 5-12 down by one position
UPDATE agenda_item_templates 
SET section_order = section_order + 1,
    updated_at = now()
WHERE section_order BETWEEN 5 AND 12 AND is_active = true;

-- Move General Evaluator opening to position 5
UPDATE agenda_item_templates 
SET section_order = 5,
    updated_at = now()
WHERE section_name = 'General Evaluator opening';

-- Now update existing meeting agenda items
-- First, update General Evaluator opening to temp position
UPDATE meeting_agenda_items 
SET section_order = 999,
    updated_at = now()
WHERE section_name = 'General Evaluator opening';

-- Shift existing meeting sections 5-12 down by one
UPDATE meeting_agenda_items 
SET section_order = section_order + 1,
    updated_at = now()
WHERE section_order BETWEEN 5 AND 12;

-- Move General Evaluator opening to position 5 in existing meetings
UPDATE meeting_agenda_items 
SET section_order = 5,
    updated_at = now()
WHERE section_name = 'General Evaluator opening';
