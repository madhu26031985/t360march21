/*
  # Create Tag Team Agenda Template

  ## Summary
  Creates a Tag Team agenda item template that can be included in meeting agendas.
  This template represents the section where Timer, Ah Counter, and Grammarian are
  assigned and displayed.

  ## Changes
  1. Insert Tag Team template into agenda_item_templates
  2. Set appropriate defaults for section order, duration, etc.

  ## Template Details
  - Section Name: Tag Team
  - Section Icon: 🏷️
  - Default Duration: 5 minutes
  - Not role-based (uses special tag team fields instead)
  - Always visible and active
*/

-- Insert Tag Team template
INSERT INTO agenda_item_templates (
  section_name,
  section_description,
  section_icon,
  section_order,
  default_duration_minutes,
  is_role_based,
  role_classification,
  is_active,
  club_id
)
VALUES (
  'Tag Team',
  'Timer, Ah Counter, and Grammarian assignments for the meeting',
  '🏷️',
  5,
  5,
  false,
  'tag_team',
  true,
  null
)
ON CONFLICT DO NOTHING;
