/*
  # Add User View Policy for Ah Counter Reports

  ## Summary
  This migration adds an RLS policy to allow users to view their own ah counter reports
  based on speaker_user_id. This ensures users can see filler word tracking data for their
  own speeches regardless of club membership status.

  ## Problem
  Users cannot view their own ah counter reports in the "Ah Counter Reports" screen because
  the existing RLS policy only allows viewing reports from clubs the user is currently a 
  member of. If they leave a club or want to see their personal filler word trends, they
  lose access to their historical data.

  ## Solution
  Add a new RLS policy that allows users to view ah counter reports where they are the speaker
  (speaker_user_id = auth.uid()), ensuring users always have access to their own filler word data.

  ## Changes
  - New policy: "Users can view their own ah counter reports as speaker"
*/

-- Policy for users to view their own ah counter reports as speaker
CREATE POLICY "Users can view their own ah counter reports as speaker"
  ON ah_counter_reports
  FOR SELECT
  TO authenticated
  USING (speaker_user_id = auth.uid());

-- Add comment for documentation
COMMENT ON POLICY "Users can view their own ah counter reports as speaker" ON ah_counter_reports IS
  'Allows users to view all ah counter reports where they are the speaker, enabling them to track their filler word usage over time';
