/*
  # Fix Agenda Templates and Recreate All Sections for All Meetings

  ## Summary
  This migration:
  1. Fixes section ordering for agenda templates
  2. Adds missing "Evaluation Session" template
  3. Deletes all existing agenda items for all meetings
  4. Recreates all 15 agenda sections for every meeting (hidden by default)

  ## Changes
  
  1. Update section_order for existing templates to proper sequence
  2. Add missing "Evaluation Session" template
  3. Delete all existing meeting_agenda_items
  4. Recreate all 15 sections for every meeting
  
  ## Security
    - No RLS changes needed
*/

-- Fix section ordering for existing templates
UPDATE agenda_item_templates SET section_order = 1 WHERE section_name = 'Meet and Greet';
UPDATE agenda_item_templates SET section_order = 2 WHERE section_name = 'Call to Order';
UPDATE agenda_item_templates SET section_order = 3 WHERE section_name = 'Presiding Officer Address';
UPDATE agenda_item_templates SET section_order = 4 WHERE section_name = 'Toastmaster of the Day';
UPDATE agenda_item_templates SET section_order = 5 WHERE section_name = 'Tag Team';
UPDATE agenda_item_templates SET section_order = 6 WHERE section_name = 'Prepared Speeches Session';
UPDATE agenda_item_templates SET section_order = 7 WHERE section_name = 'Table Topics Session';
UPDATE agenda_item_templates SET section_order = 8 WHERE section_name = 'Ancillary Speakers';
UPDATE agenda_item_templates SET section_order = 9 WHERE section_name = 'Educational Speaker';
UPDATE agenda_item_templates SET section_order = 10 WHERE section_name = 'Evaluation Session';
UPDATE agenda_item_templates SET section_order = 11 WHERE section_name = 'General Evaluator Report';
UPDATE agenda_item_templates SET section_order = 12 WHERE section_name = 'Quiz Session';
UPDATE agenda_item_templates SET section_order = 13 WHERE section_name = 'Voting';
UPDATE agenda_item_templates SET section_order = 14 WHERE section_name = 'Awards';
UPDATE agenda_item_templates SET section_order = 15 WHERE section_name = 'Closing Remarks';

-- Add missing "Evaluation Session" template if it doesn't exist
INSERT INTO agenda_item_templates (
  section_name,
  section_description,
  section_icon,
  section_order,
  is_role_based,
  role_classification,
  default_duration_minutes,
  is_active
)
SELECT 
  'Evaluation Session',
  'Individual speech evaluations',
  '📊',
  10,
  true,
  'evaluation',
  5,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM agenda_item_templates 
  WHERE section_name = 'Evaluation Session'
);

-- Delete all existing agenda items
DELETE FROM meeting_agenda_items;

-- Recreate all 15 agenda sections for every meeting
DO $$
DECLARE
  v_meeting RECORD;
  v_template RECORD;
  v_section_order INTEGER;
BEGIN
  -- Loop through all meetings with valid club references
  FOR v_meeting IN 
    SELECT DISTINCT m.id, m.club_id
    FROM app_club_meeting m
    INNER JOIN club_profiles cp ON m.club_id = cp.id
  LOOP
    v_section_order := 0;
    
    -- Create all agenda sections for this meeting
    FOR v_template IN 
      SELECT * FROM agenda_item_templates
      WHERE (club_id = v_meeting.club_id OR club_id IS NULL)
        AND is_active = true
      ORDER BY section_order
    LOOP
      v_section_order := v_section_order + 1;
      
      -- Insert agenda item
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
        is_auto_generated,
        is_visible
      ) VALUES (
        v_meeting.id,
        v_meeting.club_id,
        v_template.id,
        v_template.section_name,
        v_template.section_description,
        v_template.section_icon,
        v_section_order,
        NULL,
        NULL,
        COALESCE(v_template.default_duration_minutes, 5),
        true,
        false -- All sections hidden by default
      );
    END LOOP;
    
    RAISE NOTICE 'Created % agenda sections for meeting %', v_section_order, v_meeting.id;
  END LOOP;
END;
$$;
