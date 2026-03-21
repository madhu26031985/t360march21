/*
  # Update General Evaluator Section Descriptions

  ## Summary
  Updates the descriptions for the "Evaluation Session" and "General Evaluator Report" sections
  to reflect the improved flow structure with clearer sub-sections.

  ## Changes

  1. **Update "Evaluation Session" Template Description**
     - New description explains the complete structure:
       - Speech Evaluations (Evaluator 1, 2, 3 - 3 minutes each)
       - Tag Team Report
       - Functional Role Reports (Timer, Ah-Counter, Grammarian - 2 minutes each)

  2. **Update "General Evaluator Report" Template Description**
     - New description focuses on overall meeting summary
     - Final evaluation and meeting feedback by the General Evaluator

  3. **Update Existing Meeting Agenda Items**
     - Update all existing meeting_agenda_items with the new descriptions

  ## Security
    - No RLS changes needed
*/

-- Update the "Evaluation Session" template description
UPDATE agenda_item_templates
SET
  section_description = 'Speech Evaluations (Evaluator 1, 2, 3 — 3 min each) • Tag Team Report • Functional Role Reports: Timer (2 min), Ah-Counter (2 min), Grammarian (2 min)',
  updated_at = now()
WHERE section_name = 'Evaluation Session'
  AND club_id IS NULL;

-- Update the "General Evaluator Report" template description
UPDATE agenda_item_templates
SET
  section_description = 'Overall meeting summary and final evaluation by the General Evaluator',
  updated_at = now()
WHERE section_name = 'General Evaluator Report'
  AND club_id IS NULL;

-- Update existing meeting agenda items for "Evaluation Session"
UPDATE meeting_agenda_items
SET
  section_description = 'Speech Evaluations (Evaluator 1, 2, 3 — 3 min each) • Tag Team Report • Functional Role Reports: Timer (2 min), Ah-Counter (2 min), Grammarian (2 min)',
  updated_at = now()
WHERE section_name = 'Evaluation Session'
  AND is_auto_generated = true;

-- Update existing meeting agenda items for "General Evaluator Report"
UPDATE meeting_agenda_items
SET
  section_description = 'Overall meeting summary and final evaluation by the General Evaluator',
  updated_at = now()
WHERE section_name = 'General Evaluator Report'
  AND is_auto_generated = true;
