/*
  # Add Educational Speaker Section to Agenda
  
  ## Summary
  Adds the Educational Speaker section to the meeting agenda templates.
  This section appears between Table Topics (order 6) and Evaluation Session (order 7).
  
  ## Changes
  1. Update Orders
    - Shift existing sections from order 7 onwards up by 1
    - Make room for Educational Speaker at order 7
  
  2. New Section
    - Educational Speaker section with educational_speaker role classification
    - 10 minute default duration
    
  ## Security
    - No RLS changes needed (inherits from table policies)
*/

-- First, shift all sections with order >= 7 up by 1 to make room
UPDATE agenda_item_templates
SET section_order = section_order + 1
WHERE section_order >= 7 AND club_id IS NULL;

-- Insert the Educational Speaker section
INSERT INTO agenda_item_templates (
  section_name, 
  section_description, 
  section_icon, 
  section_order, 
  default_duration_minutes, 
  is_role_based, 
  role_classification
)
SELECT 
  'Educational Speaker',
  'Educational session with key learning points',
  '📚',
  7,
  10,
  true,
  'educational_speaker'
WHERE NOT EXISTS (
  SELECT 1 FROM agenda_item_templates 
  WHERE section_name = 'Educational Speaker' 
  AND club_id IS NULL
);

-- Add comment for documentation
COMMENT ON TABLE agenda_item_templates IS 
  'Templates for standard meeting agenda sections. Educational Speaker added at order 7 between Table Topics and Evaluation Session.';