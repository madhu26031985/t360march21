/*
  # Add TMOD placeholder sections to agenda

  ## Summary
  Adds two non–role-based agenda sections modelled on the existing Break section:
  - "TMOD continues with theme"
  - "TMOD closing section"

  Both are simple placeholders with description + duration, and are hidden by default on existing agendas.
*/

-- Insert new templates (append at the end of the default template list)
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
  v.section_order,
  v.default_duration_minutes,
  false,
  NULL,
  true
FROM (
  VALUES
    ('TMOD continues with theme', 'Transition segment where the TMOD continues with the theme', '🎭', 999, 5),
    ('TMOD closing section', 'Closing segment by the TMOD to wrap up the meeting', '🎤', 1000, 5)
) AS v(section_name, section_description, section_icon, section_order, default_duration_minutes);

-- Normalize section_order so the new templates follow the Break section for default (club_id IS NULL) templates
DO $$
DECLARE
  break_order integer;
  max_order integer;
BEGIN
  SELECT section_order INTO break_order
  FROM agenda_item_templates
  WHERE club_id IS NULL AND section_name = 'Break'
  ORDER BY id DESC
  LIMIT 1;

  IF break_order IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(section_order), break_order) INTO max_order
  FROM agenda_item_templates
  WHERE club_id IS NULL;

  -- Reposition TMOD placeholders to be immediately after Break (maintain relative order)
  UPDATE agenda_item_templates
  SET section_order = break_order + 1
  WHERE club_id IS NULL AND section_name = 'TMOD continues with theme';

  UPDATE agenda_item_templates
  SET section_order = break_order + 2
  WHERE club_id IS NULL AND section_name = 'TMOD closing section';
END $$;

-- Populate placeholders for existing meetings (hidden by default)
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
  t.default_duration_minutes,
  true AS is_auto_generated,
  false AS is_visible
FROM app_club_meeting m
CROSS JOIN agenda_item_templates t
WHERE t.club_id IS NULL
  AND t.section_name IN ('TMOD continues with theme', 'TMOD closing section')
  AND NOT EXISTS (
    SELECT 1
    FROM meeting_agenda_items mai
    WHERE mai.meeting_id = m.id
      AND mai.section_name = t.section_name
  );

