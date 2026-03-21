/*
  # Fix Club Join Requests Insert Policy

  1. Changes
    - Drop existing restrictive insert policy
    - Create new insert policy that properly checks for authenticated relationships
    - Only prevent requests if user is an authenticated member (is_authenticated = true)
    
  2. Security
    - Users can only insert their own requests
    - Must be authenticated
    - Status must be 'pending' on insert
    - Can't create request if already an authenticated member of the club
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "users_can_create_requests" ON club_join_requests;

-- Create new insert policy with proper check
CREATE POLICY "users_can_create_requests"
  ON club_join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND status = 'pending'
    AND NOT EXISTS (
      SELECT 1
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.club_id = club_join_requests.club_id
        AND app_club_user_relationship.is_authenticated = true
    )
  );
