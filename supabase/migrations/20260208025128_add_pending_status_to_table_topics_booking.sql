/*
  # Add 'pending' status to table topics booking_status

  1. Changes
    - Update check constraint to allow 'pending' status
    - This enables saving unassigned questions with 'pending' status
  
  2. Valid statuses
    - 'pending': Question created but not assigned to anyone yet
    - 'booked': Question assigned to a participant
    - 'withdrawn': Question removed/cancelled
*/

-- Drop the old constraint
ALTER TABLE app_meeting_tabletopicscorner 
DROP CONSTRAINT IF EXISTS chk_tt_corner_booking_status;

-- Add updated constraint with 'pending' status
ALTER TABLE app_meeting_tabletopicscorner 
ADD CONSTRAINT chk_tt_corner_booking_status 
CHECK (booking_status IN ('pending', 'booked', 'withdrawn'));