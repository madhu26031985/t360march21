/*
  # Re-add Speech Evaluation Session (Idempotent)

  This migration re-creates the "Speech Evaluation Session" agenda template and
  inserts it into existing meetings ONLY when the section is missing.

  Why this exists:
  - Some environments may end up without the "Speech Evaluation Session" section.
  - Re-running the original migration blindly can re-shift `section_order` multiple times.
  - This version shifts orders only for clubs/meetings where the section is missing.
*/

BEGIN;

-- NOTE:
-- In Postgres, CTEs (WITH ...) are scoped to a single SQL statement.
-- This migration needs the computed sets across multiple statements,
-- so we materialize them into TEMP TABLEs.

-- Clubs whose templates are missing "Speech Evaluation Session"
CREATE TEMP TABLE missing_clubs AS
SELECT DISTINCT ait.club_id
FROM agenda_item_templates ait
WHERE ait.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM agenda_item_templates ait2
    WHERE ait2.section_name = 'Speech Evaluation Session'
      AND ait2.club_id IS NOT DISTINCT FROM ait.club_id
  );

-- Meetings whose agenda is missing "Speech Evaluation Session"
CREATE TEMP TABLE missing_meetings AS
SELECT DISTINCT mai.meeting_id
FROM meeting_agenda_items mai
WHERE NOT EXISTS (
  SELECT 1
  FROM meeting_agenda_items mai2
  WHERE mai2.meeting_id = mai.meeting_id
    AND mai2.section_name = 'Speech Evaluation Session'
);
-- Shift template section ordering only for missing clubs
UPDATE agenda_item_templates
SET section_order = section_order + 1,
    updated_at = now()
WHERE section_order >= 12
  AND is_active = true
  AND EXISTS (
    SELECT 1
    FROM missing_clubs mc
    WHERE mc.club_id IS NOT DISTINCT FROM agenda_item_templates.club_id
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
  mc.club_id,
  'Speech Evaluation Session',
  'Speech evaluators provide detailed feedback on prepared speeches delivered during the meeting',
  12,
  15,
  true,
  'speech_evaluator',
  true
FROM missing_clubs mc
ON CONFLICT DO NOTHING;

-- Shift meeting section ordering only for meetings missing this section
UPDATE meeting_agenda_items
SET section_order = section_order + 1,
    updated_at = now()
WHERE section_order >= 12
  AND meeting_id IN (SELECT meeting_id FROM missing_meetings);

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
FROM meetings m
WHERE m.id IN (SELECT meeting_id FROM missing_meetings)
  AND NOT EXISTS (
    SELECT 1
    FROM meeting_agenda_items mai
    WHERE mai.meeting_id = m.id
      AND mai.section_name = 'Speech Evaluation Session'
  );

COMMIT;

