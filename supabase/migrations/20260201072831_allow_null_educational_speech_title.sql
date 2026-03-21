/*
  # Allow NULL for Educational Speech Title

  ## Summary
  Removes the NOT NULL constraint from the `speech_title` column in the 
  `app_meeting_educational_speaker` table to allow users to clear or save 
  without a title.

  ## Changes
  1. Modify Column
    - `speech_title` in `app_meeting_educational_speaker` - Change from NOT NULL to nullable

  ## Notes
  - Users can now clear the educational speech title field
  - Empty titles will be stored as NULL in the database
  - This allows more flexibility in saving draft educational content
*/

-- Remove NOT NULL constraint from speech_title column
ALTER TABLE app_meeting_educational_speaker 
  ALTER COLUMN speech_title DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN app_meeting_educational_speaker.speech_title IS 
  'Title of the educational speech. Can be NULL to allow clearing the field or saving drafts without a title.';