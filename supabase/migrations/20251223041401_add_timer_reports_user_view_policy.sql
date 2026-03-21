/*
  # Add User View Policy for Timer Reports

  ## Summary
  This migration adds an RLS policy to allow users to view their own timer reports
  regardless of club membership status. This ensures that users can always see their
  own speaking history even if they leave a club.

  ## Problem
  Users cannot view their own timer reports in the "My Timer Records" screen because
  the existing RLS policy only allows viewing timer reports from clubs the user is
  currently a member of. If a user leaves a club or the club relationship changes,
  they lose access to their historical timer records.

  ## Solution
  Add a new RLS policy that allows users to view timer reports where they are the speaker
  (speaker_user_id = auth.uid()), ensuring users always have access to their own records.

  ## Changes
  - New policy: "Users can view their own timer reports"
*/

-- Policy for users to view their own timer reports
CREATE POLICY "Users can view their own timer reports"
  ON timer_reports
  FOR SELECT
  TO authenticated
  USING (speaker_user_id = auth.uid());

-- Add comment for documentation
COMMENT ON POLICY "Users can view their own timer reports" ON timer_reports IS
  'Allows users to view all timer reports where they are the speaker, regardless of club membership status';
