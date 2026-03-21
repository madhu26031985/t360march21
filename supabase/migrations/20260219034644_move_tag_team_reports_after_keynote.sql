/*
  # Move TAG Team Reports After Keynote Speaker
  
  1. Changes
    - Move Timer Report from position 6 to position 15
    - Move Ah Counter Report from position 7 to position 16
    - Move Grammarian Report from position 8 to position 17
  
  2. Impact
    - Shift sections between old and new positions appropriately
    - Update both templates and existing meeting agenda items
  
  3. New Order
    - After Keynote Speaker (position 14)
    - Before Break (shifts to position 18)
*/

-- First, update templates
-- Shift sections 9-14 back by 3 positions (to fill the gap left by TAG reports)
UPDATE agenda_item_templates 
SET section_order = section_order - 3,
    updated_at = now()
WHERE section_order BETWEEN 9 AND 14 AND is_active = true;

-- Move TAG team reports to after Keynote Speaker
UPDATE agenda_item_templates 
SET section_order = 12,
    updated_at = now()
WHERE section_name = 'Timer Report' AND is_active = true;

UPDATE agenda_item_templates 
SET section_order = 13,
    updated_at = now()
WHERE section_name = 'Ah Counter Report' AND is_active = true;

UPDATE agenda_item_templates 
SET section_order = 14,
    updated_at = now()
WHERE section_name = 'Grammarian Report' AND is_active = true;

-- Shift Break and everything after it up by 3 positions
UPDATE agenda_item_templates 
SET section_order = section_order + 3,
    updated_at = now()
WHERE section_order >= 12 
  AND section_name NOT IN ('Timer Report', 'Ah Counter Report', 'Grammarian Report')
  AND is_active = true;

-- Now update existing meeting agenda items
-- Shift sections 9-14 back by 3 positions
UPDATE meeting_agenda_items 
SET section_order = section_order - 3,
    updated_at = now()
WHERE section_order BETWEEN 9 AND 14;

-- Move TAG team reports in existing meetings
UPDATE meeting_agenda_items 
SET section_order = 15,
    updated_at = now()
WHERE section_name = 'Timer Report';

UPDATE meeting_agenda_items 
SET section_order = 16,
    updated_at = now()
WHERE section_name = 'Ah Counter Report';

UPDATE meeting_agenda_items 
SET section_order = 17,
    updated_at = now()
WHERE section_name = 'Grammarian Report';

-- Shift Break and everything after it up by 3 positions
UPDATE meeting_agenda_items 
SET section_order = section_order + 3,
    updated_at = now()
WHERE section_order >= 15 
  AND section_name NOT IN ('Timer Report', 'Ah Counter Report', 'Grammarian Report');
