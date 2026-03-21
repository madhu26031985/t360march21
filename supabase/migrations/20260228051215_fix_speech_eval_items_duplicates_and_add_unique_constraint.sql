/*
  # Fix speech_evaluation_items duplicates and add missing unique constraint

  ## Problem
  The trigger `sync_speech_evaluation_items` uses ON CONFLICT (agenda_item_id, speaker_id)
  but no unique constraint exists on that pair, causing:
    "there is no unique or exclusion constraint matching the ON CONFLICT specification"

  This breaks pathway updates and evaluator assignments.

  ## Fix
  1. Remove duplicate rows (keeping the most recently created record per agenda_item_id+speaker_id)
  2. Add the missing unique constraint so the trigger works correctly
*/

-- Step 1: Delete older duplicate rows, keeping the most recently created one per pair
DELETE FROM speech_evaluation_items
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY agenda_item_id, speaker_id
             ORDER BY created_at DESC
           ) AS rn
    FROM speech_evaluation_items
  ) ranked
  WHERE rn > 1
);

-- Step 2: Add the missing unique constraint
ALTER TABLE speech_evaluation_items
  ADD CONSTRAINT unique_speech_eval_items_agenda_speaker
  UNIQUE (agenda_item_id, speaker_id);
