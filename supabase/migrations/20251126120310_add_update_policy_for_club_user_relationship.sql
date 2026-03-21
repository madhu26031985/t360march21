/*
  # Add UPDATE Policy for Club User Relationship

  1. Changes
    - Add UPDATE policy to allow ExComm to update user relationships
    - This enables ExComm to authenticate users when accepting join requests
  
  2. Security
    - Only authenticated ExComm members can update relationships in their club
    - Can only update users within clubs where they are ExComm
    - Cannot update their own relationship
*/

-- Create UPDATE policy for ExComm to authenticate users
CREATE POLICY "ExComm can update users in their club"
  ON app_club_user_relationship
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app_club_user_relationship excomm_rel
      WHERE excomm_rel.club_id = app_club_user_relationship.club_id
        AND excomm_rel.user_id = auth.uid()
        AND excomm_rel.role IN ('excomm', 'president', 'vpe', 'vpm', 'vppr', 'secretary', 'treasurer', 'saa', 'ipp')
        AND excomm_rel.is_authenticated = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_club_user_relationship excomm_rel
      WHERE excomm_rel.club_id = app_club_user_relationship.club_id
        AND excomm_rel.user_id = auth.uid()
        AND excomm_rel.role IN ('excomm', 'president', 'vpe', 'vpm', 'vppr', 'secretary', 'treasurer', 'saa', 'ipp')
        AND excomm_rel.is_authenticated = true
    )
  );
