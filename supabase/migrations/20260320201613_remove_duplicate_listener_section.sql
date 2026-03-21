/*
  # Remove duplicate Listener section (Section 26)

  There are two listener-related sections in the agenda:
  - "Listener Section" - "Dedicated time for an active listener to share meeting observations and feedback." (KEEP)
  - "Listener" - "Listener section for attentive listening notes" (REMOVE - Section 26)

  This migration removes the duplicate "Listener" section from both
  meeting_agenda_items and agenda_item_templates.
*/

-- 1) Remove from meeting_agenda_items (the agenda cards shown per meeting)
-- "Listener" = Section 26 (duplicate). "Listener Section" = Section 25 (keep).
DELETE FROM meeting_agenda_items
WHERE section_name = 'Listener';

-- 2) Deactivate the template (so it won't be added to new meetings)
UPDATE agenda_item_templates
SET is_active = false,
    updated_at = now()
WHERE section_name = 'Listener';
