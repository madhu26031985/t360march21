/*
  # Change Evaluation Session to Keynote Speaker

  ## Summary
  This migration updates the agenda section from "Evaluation Session" to "Keynote Speaker" with a new description.

  ## Changes
  1. **Update Template**: Change agenda_item_templates
     - section_name: "Evaluation Session" → "Keynote Speaker"
     - section_description: "Individual speech evaluations" → "Presents a value-driven keynote speech"
     - section_icon: "📊" → "🎤"
     - role_classification: "evaluation" → "Keynote speakers"
     
  2. **Update Existing Items**: Update all meeting_agenda_items with old section name

  ## Details
  - All existing meetings with "Evaluation Session" will be updated to "Keynote Speaker"
  - Maintains section_order and other properties
*/

-- Update the agenda_item_templates table
UPDATE agenda_item_templates
SET 
  section_name = 'Keynote Speaker',
  section_description = 'Presents a value-driven keynote speech',
  section_icon = '🎤',
  role_classification = 'Keynote speakers',
  updated_at = now()
WHERE section_name = 'Evaluation Session';

-- Update all existing meeting_agenda_items
UPDATE meeting_agenda_items
SET 
  section_name = 'Keynote Speaker',
  section_description = 'Presents a value-driven keynote speech',
  section_icon = '🎤',
  updated_at = now()
WHERE section_name = 'Evaluation Session';
