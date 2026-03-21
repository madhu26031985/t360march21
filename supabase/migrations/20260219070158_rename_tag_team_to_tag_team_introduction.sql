/*
  # Rename Tag Team to Tag Team Introduction
  
  1. Purpose
    - Update the section name from "Tag Team" to "Tag Team Introduction"
    - This applies to both the template and all existing meeting agenda items
  
  2. Changes
    - Update agenda_item_templates table
    - Update all existing meeting_agenda_items records
  
  3. Notes
    - Makes the section name more descriptive
    - Changes will apply to all past and future meetings
*/

-- Update the template
UPDATE agenda_item_templates
SET section_name = 'Tag Team Introduction'
WHERE section_name = 'Tag Team';

-- Update all existing agenda items
UPDATE meeting_agenda_items
SET section_name = 'Tag Team Introduction'
WHERE section_name = 'Tag Team';
