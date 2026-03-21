/*
  # Add General Evaluator Opening Section

  ## Summary
  Adds a new "General Evaluator opening" agenda section that appears before the "General Evaluator Report" section.

  ## Changes
  1. **Shift Existing Sections**: Increment section_order for all templates with order >= 12 to make room
  2. **Insert New Template**: Add "General Evaluator opening" at position 12
     - section_name: "General Evaluator opening"
     - section_description: "The General Evaluator introduces the TAG function and explains its purpose, roles, and his own responsibilities."
     - section_icon: "🎬"
     - role_classification: "general_evaluator"
     - default_duration_minutes: 5
  3. **Update Existing Agendas**: Shift section_order in existing meeting_agenda_items

  ## Details
  - Uses the same role_classification as General Evaluator Report
  - Will be assigned to the same person as General Evaluator
  - Appears right before the General Evaluator Report section
*/

-- Step 1: Shift existing templates to make room at position 12
UPDATE agenda_item_templates
SET section_order = section_order + 1
WHERE club_id IS NULL 
  AND section_order >= 12
  AND is_active = true;

-- Step 2: Insert the new General Evaluator opening template
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
) VALUES (
  NULL,
  'General Evaluator opening',
  'The General Evaluator introduces the TAG function and explains its purpose, roles, and his own responsibilities.',
  '🎬',
  12,
  5,
  true,
  'general_evaluator',
  true
);

-- Step 3: Shift existing meeting agenda items to accommodate the new section
-- This updates all existing meetings that have sections at order 12 or above
UPDATE meeting_agenda_items
SET section_order = section_order + 1
WHERE section_order >= 12;

-- Step 4: Create the new section for all existing meetings that don't have it yet
-- This adds the new section to all existing meetings
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
  m.id as meeting_id,
  m.club_id,
  t.id as template_id,
  t.section_name,
  t.section_description,
  t.section_icon,
  12 as section_order,
  t.default_duration_minutes as duration_minutes,
  true as is_auto_generated,
  false as is_visible
FROM app_club_meeting m
CROSS JOIN agenda_item_templates t
WHERE t.section_name = 'General Evaluator opening'
  AND t.club_id IS NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM meeting_agenda_items mai 
    WHERE mai.meeting_id = m.id 
      AND mai.section_name = 'General Evaluator opening'
  );
