/*
  # Update General Evaluator Report with Detailed Structure

  ## Summary
  Updates the "General Evaluator Report" description to show the complete meeting flow
  with all sub-sections that should be covered during this segment.

  ## Changes

  1. **Update "General Evaluator Report" Description**
     - Shows the improved flow structure:
       - Speech Evaluations (Evaluator 1, 2, 3 — 3 min each)
       - Tag Team Report
       - Functional Role Reports (Timer, Ah-Counter, Grammarian — 2 min each)
       - Overall Meeting Summary by General Evaluator

  2. **Update Existing Meeting Agenda Items**
     - Apply the new description to all existing meetings

  ## Security
    - No RLS changes needed
*/

-- Update the "General Evaluator Report" template description with full structure
UPDATE agenda_item_templates
SET
  section_description = 'Speech Evaluations: Evaluator 1, 2, 3 (3 min each) • Tag Team Report • Functional Reports: Timer (2 min), Ah-Counter (2 min), Grammarian (2 min) • Overall Meeting Summary by GE',
  updated_at = now()
WHERE section_name = 'General Evaluator Report'
  AND club_id IS NULL;

-- Update existing meeting agenda items for "General Evaluator Report"
UPDATE meeting_agenda_items
SET
  section_description = 'Speech Evaluations: Evaluator 1, 2, 3 (3 min each) • Tag Team Report • Functional Reports: Timer (2 min), Ah-Counter (2 min), Grammarian (2 min) • Overall Meeting Summary by GE',
  updated_at = now()
WHERE section_name = 'General Evaluator Report'
  AND is_auto_generated = true;
