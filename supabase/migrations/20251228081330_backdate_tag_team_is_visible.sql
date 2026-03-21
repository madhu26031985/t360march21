/*
  # Backdate Tag Team is_visible

  ## Summary
  Updates all existing Tag Team agenda items to have is_visible = true.
  This ensures they appear in both the agenda editor and meeting agenda view.

  ## Changes
  - Set is_visible = true for all existing Tag Team items
*/

-- Update existing Tag Team items to be visible
UPDATE meeting_agenda_items
SET is_visible = true
WHERE section_name ILIKE '%tag%team%'
  AND (is_visible IS NULL OR is_visible = false);
