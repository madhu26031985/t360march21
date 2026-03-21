/*
  # Fix Join Requests View Policy
  
  1. Changes
    - Drop existing restrictive ExComm-only view policy
    - Create new policy allowing all authenticated club members to view join requests
    - This allows regular members to see join requests (read-only)
    - Only ExComm can still approve/reject (separate update policy)
    
  2. Security
    - All authenticated club members can view pending join requests for their club
    - Only ExComm members can update (approve/reject) requests
*/

-- Drop existing restrictive view policy
DROP POLICY IF EXISTS "excomm_can_view_club_requests" ON club_join_requests;

-- Create new policy allowing all authenticated club members to view
CREATE POLICY "club_members_can_view_requests"
  ON club_join_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.club_id = club_join_requests.club_id
        AND app_club_user_relationship.is_authenticated = true
    )
  );
