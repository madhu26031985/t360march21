/*
  # Add Listener Section Template

  1. Changes
    - Add a Listener section to `agenda_item_templates`
    - Non-role-based by default; Edit Agenda will still allow assigning a member

  2. Security
    - No RLS changes needed
*/

INSERT INTO agenda_item_templates (
  section_name,
  section_description,
  section_icon,
  section_order,
  default_duration_minutes,
  is_role_based,
  role_classification,
  is_active
)
VALUES (
  'Listener Section',
  'Dedicated time for an active listener to share meeting observations and feedback.',
  '👂',
  120,
  5,
  false,
  NULL,
  true
)
ON CONFLICT DO NOTHING;

