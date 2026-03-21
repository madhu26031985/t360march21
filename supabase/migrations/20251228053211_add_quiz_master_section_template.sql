/*
  # Add Quiz Master Section Template

  1. Changes
    - Add Quiz Master section to agenda_item_templates
    - Similar to Table Topics Master section
    - Positioned after Table Topics section
  
  2. Security
    - No RLS changes needed
*/

-- Insert Quiz Master section template
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
  'Quiz Session',
  'Interactive quiz session led by Quiz Master',
  '🎯',
  90,
  10,
  true,
  'quiz_master',
  true
)
ON CONFLICT DO NOTHING;