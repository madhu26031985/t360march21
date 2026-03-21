/*
  # Fix ExComm Join Request Review Policy

  1. Changes
    - Drop the old `excomm_can_review_requests` policy
    - Create new policy that includes 'excomm' role
    - This allows users with role 'excomm' to accept/reject join requests
  
  2. Security
    - Policy ensures only authenticated club members with excomm-level roles can review
    - Can only update pending requests
    - Can only change status to approved/rejected
*/

-- Drop the old policy
DROP POLICY IF EXISTS "excomm_can_review_requests" ON club_join_requests;

-- Create new policy that includes 'excomm' role
CREATE POLICY "excomm_can_review_requests"
  ON club_join_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.club_id = club_join_requests.club_id
        AND app_club_user_relationship.is_authenticated = true
        AND app_club_user_relationship.role IN ('excomm', 'president', 'vpe', 'vpm', 'vppr', 'secretary', 'treasurer', 'saa', 'ipp')
    )
    AND status = 'pending'
  )
  WITH CHECK (
    status IN ('pending', 'approved', 'rejected')
  );
