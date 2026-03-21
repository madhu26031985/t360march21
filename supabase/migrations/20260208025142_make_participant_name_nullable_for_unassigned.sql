/*
  # Make participant_name nullable for unassigned questions

  1. Changes
    - Allow `participant_name` to be NULL when no participant is assigned
    - Update check constraint to allow NULL values
  
  2. Rationale
    - Questions can be saved before assignment
    - NULL participant_name for unassigned questions is cleaner than placeholder text
*/

-- Drop the old constraint
ALTER TABLE app_meeting_tabletopicscorner 
DROP CONSTRAINT IF EXISTS chk_participant_name_not_empty;

-- Make participant_name nullable
ALTER TABLE app_meeting_tabletopicscorner 
ALTER COLUMN participant_name DROP NOT NULL;

-- Add updated constraint that allows NULL or non-empty strings
ALTER TABLE app_meeting_tabletopicscorner 
ADD CONSTRAINT chk_participant_name_not_empty 
CHECK (participant_name IS NULL OR (TRIM(participant_name) <> ''));