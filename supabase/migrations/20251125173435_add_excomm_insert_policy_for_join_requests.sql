/*
  # Add ExComm Insert Policy for Join Requests

  ## Changes
  - Add new RLS policy to allow ExComm members to add users to their club
  - This enables accepting join requests by adding users to app_club_user_relationship
  
  ## Security
  - Policy restricted to authenticated users
  - Only allows ExComm members to insert relationships for their own club
  - User must have role = 'excomm' in their club relationship
*/

-- Drop policy if it exists (for re-running migration)
DROP POLICY IF EXISTS "ExComm can add users to their club" ON app_club_user_relationship;

-- Allow ExComm members to add users to their club
CREATE POLICY "ExComm can add users to their club"
  ON app_club_user_relationship
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM app_club_user_relationship excomm_rel
      WHERE excomm_rel.club_id = app_club_user_relationship.club_id
        AND excomm_rel.user_id = auth.uid()
        AND excomm_rel.role = 'excomm'
        AND excomm_rel.is_authenticated = true
    )
  );
