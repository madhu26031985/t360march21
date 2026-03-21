/*
  # Remove Educational Speech Title Check Constraint

  ## Summary
  Drops the CHECK constraint that prevents NULL or empty values in the 
  `speech_title` column of the `app_meeting_educational_speaker` table.

  ## Changes
  1. Drop Constraint
    - Remove `chk_educational_speaker_title_not_empty` check constraint
    - This constraint was enforcing NOT NULL and non-empty string validation

  ## Notes
  - Users can now save NULL or empty educational speech titles
  - This allows clearing the title field and saving drafts without a title
*/

-- Drop the check constraint that prevents NULL or empty titles
ALTER TABLE app_meeting_educational_speaker 
  DROP CONSTRAINT IF EXISTS chk_educational_speaker_title_not_empty;