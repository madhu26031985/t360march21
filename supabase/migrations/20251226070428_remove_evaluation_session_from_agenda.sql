/*
  # Remove Evaluation Session from Agenda
  
  ## Summary
  Removes the Evaluation Session section from the meeting agenda templates.
  This section was at order 8 and needs to be removed, with subsequent sections
  shifting up in order.
  
  ## Changes
  1. Delete Evaluation Session template
  2. Shift all sections after order 8 down by 1
  
  ## Security
    - No RLS changes needed
*/

-- Delete the Evaluation Session template
DELETE FROM agenda_item_templates
WHERE section_name = 'Evaluation Session' 
AND club_id IS NULL;

-- Shift all sections with order >= 9 down by 1
UPDATE agenda_item_templates
SET section_order = section_order - 1
WHERE section_order >= 9 AND club_id IS NULL;

-- Add comment for documentation
COMMENT ON TABLE agenda_item_templates IS 
  'Templates for standard meeting agenda sections. Evaluation Session removed from default templates.';