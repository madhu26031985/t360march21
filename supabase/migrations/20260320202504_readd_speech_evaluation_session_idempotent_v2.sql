/*
  # Re-add Speech Evaluation Session (Idempotent v2)

  This migration ensures the "Speech Evaluation Session" agenda section exists.
  It is safe to re-run: it will not shift orders again once the section exists.

  Inserts:
  - agenda_item_templates row(s) for missing clubs
  - meeting_agenda_items row(s) for meetings missing the section

  Order shifting:
  - shifts template and meeting section_order only for clubs/meetings where the section is missing
*/

BEGIN;

-- Shift template section ordering only for clubs that are missing the template
UPDATE agenda_item_templates t
SET section_order = t.section_order + 1,
    updated_at = now()
WHERE t.section_order >= 12
  AND t.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM agenda_item_templates s
    WHERE s.section_name = 'Speech Evaluation Session'
      AND s.club_id IS NOT DISTINCT FROM t.club_id
  );

-- Insert missing template(s)
INSERT INTO agenda_item_templates (
  club_id,
  section_name,
  section_description,
  section_order,
  default_duration_minutes,
  is_role_based,
  role_classification,
  is_active
)
SELECT
  c.club_id,
  'Speech Evaluation Session',
  'Speech evaluators provide detailed feedback on prepared speeches delivered during the meeting',
  12,
  15,
  true,
  'speech_evaluator',
  true
FROM (
  SELECT DISTINCT club_id
  FROM agenda_item_templates
  WHERE is_active = true
) c
WHERE NOT EXISTS (
  SELECT 1
  FROM agenda_item_templates s
  WHERE s.section_name = 'Speech Evaluation Session'
    AND s.club_id IS NOT DISTINCT FROM c.club_id
)
ON CONFLICT DO NOTHING;

-- Shift meeting section ordering only for meetings missing this section
UPDATE meeting_agenda_items mi
SET section_order = mi.section_order + 1,
    updated_at = now()
WHERE mi.section_order >= 12
  AND NOT EXISTS (
    SELECT 1
    FROM meeting_agenda_items x
    WHERE x.meeting_id = mi.meeting_id
      AND x.section_name = 'Speech Evaluation Session'
  );

-- Insert missing agenda section(s)
INSERT INTO meeting_agenda_items (
  meeting_id,
  club_id,
  section_name,
  section_description,
  section_order,
  duration_minutes,
  is_visible,
  is_auto_generated
)
SELECT
  m.id,
  m.club_id,
  'Speech Evaluation Session',
  'Speech evaluators provide detailed feedback on prepared speeches delivered during the meeting',
  12,
  15,
  true,
  true
FROM app_club_meeting m
WHERE NOT EXISTS (
  SELECT 1
  FROM meeting_agenda_items x
  WHERE x.meeting_id = m.id
    AND x.section_name = 'Speech Evaluation Session'
);

COMMIT;

