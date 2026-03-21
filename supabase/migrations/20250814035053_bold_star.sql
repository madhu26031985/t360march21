/*
  # Update RLS policies to use excomm instead of club admin

  1. Security Updates
    - Update app_club_user_relationship RLS policy to use 'excomm' role
    - Remove 'club_leader' from management permissions
    - Ensure only excomm members can manage club relationships

  2. Policy Changes
    - Replace "Club admins" with "ExComm members" in policy names
    - Update policy conditions to check for 'excomm' role specifically
    - Maintain service role access for system operations
*/

-- Drop the existing policy that allows club_leader access
DROP POLICY IF EXISTS "Club admins can manage club relationships" ON app_club_user_relationship;

-- Create new policy that only allows excomm members to manage relationships
CREATE POLICY "ExComm members can manage club relationships"
  ON app_club_user_relationship
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles up
      WHERE up.id = auth.uid()
        AND up.id IN (
          SELECT acur.user_id
          FROM app_club_user_relationship acur
          WHERE acur.club_id = app_club_user_relationship.club_id
            AND acur.role = 'excomm'
            AND acur.is_authenticated = true
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_user_profiles up
      WHERE up.id = auth.uid()
        AND up.id IN (
          SELECT acur.user_id
          FROM app_club_user_relationship acur
          WHERE acur.club_id = app_club_user_relationship.club_id
            AND acur.role = 'excomm'
            AND acur.is_authenticated = true
        )
    )
  );