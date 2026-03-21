/*
  # Remove Evaluation Session from Existing Meeting Agendas
  
  ## Summary
  Removes the Evaluation Session section from all existing meeting agendas
  and reorders subsequent sections.
  
  ## Changes
  1. Delete Evaluation Session items from meeting_agenda_items
  2. Shift all sections after order 7 down by 1
  
  ## Security
    - No RLS changes needed
*/

-- Delete the Evaluation Session from all meetings
DELETE FROM meeting_agenda_items
WHERE section_name = 'Evaluation Session';

-- Shift all sections with order >= 8 down by 1
UPDATE meeting_agenda_items
SET section_order = section_order - 1
WHERE section_order >= 8;