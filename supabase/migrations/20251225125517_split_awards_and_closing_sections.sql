/*
  # Split Awards and Closing into Separate Sections

  ## Summary
  Updates the agenda system to separate "Awards and Closing" into two distinct sections:
  - Awards (Section 10) - 10 minutes
  - Closing Remarks (Section 11) - 5 minutes

  ## Changes
  1. Update existing "Awards and Closing" templates to "Awards"
  2. Insert new "Closing Remarks" template
  3. Update meeting agenda items that reference the old section

  ## Notes
  - This applies to both default templates (club_id IS NULL) and club-specific templates
  - Existing meeting agenda items are preserved and updated
*/

-- Update existing "Awards and Closing" templates to just "Awards"
UPDATE agenda_item_templates
SET
  section_name = 'Awards',
  section_description = 'Announce winners and recognize achievements',
  default_duration_minutes = 10,
  updated_at = now()
WHERE section_name = 'Awards and Closing';

-- Insert new "Closing Remarks" template for default (global) templates
INSERT INTO agenda_item_templates (
  section_name,
  section_description,
  section_icon,
  section_order,
  default_duration_minutes,
  is_role_based,
  role_classification,
  club_id
)
SELECT
  'Closing Remarks',
  'Closing remarks and adjournment',
  '👋',
  11,
  5,
  true,
  'presiding_officer',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM agenda_item_templates
  WHERE section_name = 'Closing Remarks'
  AND club_id IS NULL
);

-- Insert new "Closing Remarks" template for each club that has custom "Awards and Closing"
INSERT INTO agenda_item_templates (
  section_name,
  section_description,
  section_icon,
  section_order,
  default_duration_minutes,
  is_role_based,
  role_classification,
  club_id
)
SELECT DISTINCT
  'Closing Remarks',
  'Closing remarks and adjournment',
  '👋',
  11,
  5,
  true,
  'presiding_officer',
  ait.club_id
FROM agenda_item_templates ait
WHERE ait.club_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM agenda_item_templates
  WHERE section_name = 'Closing Remarks'
  AND club_id = ait.club_id
);

-- Update existing meeting agenda items that reference "Awards and Closing"
UPDATE meeting_agenda_items
SET
  section_name = 'Awards',
  section_description = 'Announce winners and recognize achievements',
  duration_minutes = 10,
  end_time = start_time + INTERVAL '10 minutes',
  updated_at = now()
WHERE section_name = 'Awards and Closing';

-- For each meeting that had "Awards and Closing", add a new "Closing Remarks" item
INSERT INTO meeting_agenda_items (
  meeting_id,
  club_id,
  template_id,
  section_name,
  section_description,
  section_icon,
  section_order,
  start_time,
  end_time,
  duration_minutes,
  assigned_role_id,
  assigned_user_id,
  assigned_user_name,
  is_auto_generated,
  is_visible
)
SELECT
  mai.meeting_id,
  mai.club_id,
  (SELECT id FROM agenda_item_templates
   WHERE section_name = 'Closing Remarks'
   AND (club_id = mai.club_id OR club_id IS NULL)
   ORDER BY club_id DESC NULLS LAST
   LIMIT 1),
  'Closing Remarks',
  'Closing remarks and adjournment',
  '👋',
  mai.section_order + 1,
  mai.end_time,
  mai.end_time + INTERVAL '5 minutes',
  5,
  mai.assigned_role_id,
  mai.assigned_user_id,
  mai.assigned_user_name,
  true,
  mai.is_visible
FROM meeting_agenda_items mai
WHERE mai.section_name = 'Awards'
AND mai.section_order = 10
AND NOT EXISTS (
  SELECT 1 FROM meeting_agenda_items
  WHERE meeting_id = mai.meeting_id
  AND section_name = 'Closing Remarks'
);

-- Add comment
COMMENT ON TABLE agenda_item_templates IS 'Template agenda sections that can be customized per club. Awards and Closing are now separate sections.';
