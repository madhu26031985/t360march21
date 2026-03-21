/*
  # Fix Evaluation Record Deletion When Evaluator Removed

  ## Overview
  Fixes the issue where evaluation records in `app_prepared_speech_evaluations` are not deleted 
  when an evaluator is removed from a speech assignment.

  ## Problem
  When `assigned_evaluator_id` is set to NULL in `app_evaluation_pathway`, the corresponding
  record in `app_prepared_speech_evaluations` remains, showing stale evaluator assignments.

  ## Solution
  Update the sync trigger to:
  1. Delete evaluation records when evaluator is removed (assigned_evaluator_id becomes NULL)
  2. Update evaluation records when evaluator is changed or speech data is updated

  ## Changes
  - Modified `sync_prepared_speech_evaluation_data()` function to handle evaluator removal
  - Evaluation records are now deleted when `assigned_evaluator_id` becomes NULL
  - Existing logic for updates remains unchanged
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_sync_prepared_speech_evaluation_data ON app_evaluation_pathway;
DROP FUNCTION IF EXISTS sync_prepared_speech_evaluation_data();

-- Recreate function with deletion logic
CREATE OR REPLACE FUNCTION sync_prepared_speech_evaluation_data()
RETURNS TRIGGER AS $$
BEGIN
  -- If evaluator is being removed (becomes NULL), delete the evaluation record
  IF NEW.assigned_evaluator_id IS NULL AND OLD.assigned_evaluator_id IS NOT NULL THEN
    DELETE FROM app_prepared_speech_evaluations
    WHERE evaluation_pathway_id = NEW.id;
    
    RETURN NEW;
  END IF;
  
  -- If evaluator is assigned, update the evaluation record
  IF NEW.assigned_evaluator_id IS NOT NULL THEN
    UPDATE app_prepared_speech_evaluations
    SET
      speech_title = NEW.speech_title,
      pathway_name = NEW.pathway_name,
      project_name = NEW.project_name,
      project_number = NEW.project_number,
      level = NEW.level,
      evaluator_id = NEW.assigned_evaluator_id,
      updated_at = now()
    WHERE evaluation_pathway_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trigger_sync_prepared_speech_evaluation_data
  AFTER UPDATE OF speech_title, pathway_name, project_name, project_number, level, assigned_evaluator_id
  ON app_evaluation_pathway
  FOR EACH ROW
  EXECUTE FUNCTION sync_prepared_speech_evaluation_data();

-- Clean up: Delete any orphaned evaluation records where evaluator is no longer assigned
DELETE FROM app_prepared_speech_evaluations pse
WHERE NOT EXISTS (
  SELECT 1 FROM app_evaluation_pathway ep
  WHERE ep.id = pse.evaluation_pathway_id
    AND ep.assigned_evaluator_id = pse.evaluator_id
);
