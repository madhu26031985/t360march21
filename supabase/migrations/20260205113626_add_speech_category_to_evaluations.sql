/*
  # Add Speech Category to Prepared Speech Evaluations

  ## Summary
  Adds a speech_category field to distinguish between Prepared Speech and Ice Breaker evaluations.

  ## Changes
  1. Add speech_category column to app_prepared_speech_evaluations table
  2. Add speaker_role_name column to track the specific role (e.g., "Prepared Speaker 1")
  3. Backfill existing data based on role patterns

  ## Notes
  - Speech category can be 'Prepared Speech' or 'Ice Breaker'
  - This enables filtering evaluations by speech type in the UI
*/

-- Step 1: Add speech_category and speaker_role_name columns
ALTER TABLE app_prepared_speech_evaluations 
ADD COLUMN IF NOT EXISTS speech_category TEXT,
ADD COLUMN IF NOT EXISTS speaker_role_name TEXT;

-- Step 2: Add a check constraint for speech_category
ALTER TABLE app_prepared_speech_evaluations
DROP CONSTRAINT IF EXISTS app_prepared_speech_evaluations_speech_category_check;

ALTER TABLE app_prepared_speech_evaluations
ADD CONSTRAINT app_prepared_speech_evaluations_speech_category_check
CHECK (speech_category IN ('Prepared Speech', 'Ice Breaker'));

-- Step 3: Add comment
COMMENT ON COLUMN app_prepared_speech_evaluations.speech_category IS 
  'Category of speech: Prepared Speech or Ice Breaker';

COMMENT ON COLUMN app_prepared_speech_evaluations.speaker_role_name IS 
  'The specific role name the speaker had (e.g., Prepared Speaker 1, Ice Breaker Speech 2)';
