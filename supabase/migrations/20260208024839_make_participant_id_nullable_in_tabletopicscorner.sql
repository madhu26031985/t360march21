/*
  # Make participant_id nullable in table topics corner

  1. Changes
    - Allow `participant_id` to be NULL in `app_meeting_tabletopicscorner` table
    - This allows Table Topic Masters to save questions before assigning them to participants
  
  2. Rationale
    - Questions should be saveable before assignment
    - The booking_status field already tracks whether a question is assigned ('booked') or not ('pending')
*/

-- Make participant_id nullable
ALTER TABLE app_meeting_tabletopicscorner 
ALTER COLUMN participant_id DROP NOT NULL;
