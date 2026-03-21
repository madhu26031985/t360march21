/*
  # Fix Foreign Key Constraint for simple_poll_votes
  
  This migration fixes a foreign key constraint issue in the simple_poll_votes table
  that was causing vote registration failures.
  
  ## Problem
  - The simple_poll_votes.user_id foreign key was pointing to user_profiles table
  - The application uses app_user_profiles table instead
  - This mismatch caused foreign key violations when users tried to vote
  
  ## Changes
  1. Drop the incorrect foreign key constraint
  2. Add a new foreign key constraint pointing to app_user_profiles table
  
  ## Impact
  - Fixes the "failed to register your vote" error
  - Users will be able to submit votes successfully
*/

-- Drop the incorrect foreign key constraint
ALTER TABLE simple_poll_votes 
DROP CONSTRAINT IF EXISTS simple_poll_votes_user_id_fkey;

-- Add the correct foreign key constraint pointing to app_user_profiles
ALTER TABLE simple_poll_votes
ADD CONSTRAINT simple_poll_votes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE;
