/*
  # Backfill missing agenda templates + agenda items

  Ensures the following templates exist (club_id IS NULL) and are active:
  - Listener
  - TMOD continues with theme
  - TMOD closing section

  Then backfills meeting_agenda_items for ANY meetings missing these sections.
  This is additive only (does not delete/disable anything).
*/

-- 1) Ensure templates exist (insert only if missing)
WITH base AS (
  SELECT COALESCE(MAX(section_order), 0) AS max_order
  FROM agenda_item_templates
  WHERE club_id IS NULL AND is_active = true
)
INSERT INTO agenda_item_templates (
  club_id,
  section_name,
  section_description,
  section_icon,
  section_order,
  default_duration_minutes,
  is_role_based,
  role_classification,
  is_active
)
SELECT
  NULL,
  v.section_name,
  v.section_description,
  v.section_icon,
  (SELECT max_order FROM base) + v.order_offset,
  v.default_duration_minutes,
  v.is_role_based,
  v.role_classification,
  true
FROM (
  VALUES
    ('Listener', 'Listener section for attentive listening notes', '👂', 1, 5, true, 'role'),
    ('TMOD continues with theme', 'Transition segment where the TMOD continues with the theme', '🎭', 2, 5, false, NULL),
    ('TMOD closing section', 'Closing segment by the TMOD to wrap up the meeting', '🎤', 3, 5, false, NULL)
) AS v(section_name, section_description, section_icon, order_offset, default_duration_minutes, is_role_based, role_classification)
WHERE NOT EXISTS (
  SELECT 1
  FROM agenda_item_templates t
  WHERE t.club_id IS NULL AND t.section_name = v.section_name
);

-- 2) Backfill meeting_agenda_items for all meetings that are missing these sections
INSERT INTO meeting_agenda_items (
  meeting_id,
  club_id,
  template_id,
  section_name,
  section_description,
  section_icon,
  section_order,
  duration_minutes,
  is_auto_generated,
  is_visible
)
SELECT
  m.id AS meeting_id,
  m.club_id,
  t.id AS template_id,
  t.section_name,
  t.section_description,
  t.section_icon,
  t.section_order,
  t.default_duration_minutes AS duration_minutes,
  true AS is_auto_generated,
  false AS is_visible
FROM app_club_meeting m
JOIN agenda_item_templates t
  ON t.club_id IS NULL
 AND t.section_name IN ('Listener', 'TMOD continues with theme', 'TMOD closing section')
WHERE NOT EXISTS (
  SELECT 1
  FROM meeting_agenda_items mai
  WHERE mai.meeting_id = m.id
    AND mai.section_name = t.section_name
);

