/*
  # Fix ExComm Policy Recursion with Helper Function

  ## Problem
  The "ExComm can add other users to their club" policy queries app_club_user_relationship
  to check if the current user is ExComm. Even though this policy only applies when
  user_id != auth.uid(), Postgres still evaluates it during INSERT, causing recursion.

  ## Solution
  Create a SECURITY DEFINER function to check if user is ExComm in a club.
  This bypasses RLS and prevents recursion.

  ## Security
  - Function only checks membership for the calling user
  - SECURITY DEFINER is safe because it's read-only and user-specific
  - Returns boolean to indicate if user is ExComm in the given club
*/

-- Create helper function to check if user is ExComm in a club
CREATE OR REPLACE FUNCTION is_user_excomm_in_club(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app_club_user_relationship
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role IN ('excomm', 'president', 'vpe', 'vpm', 'vppr', 'secretary', 'treasurer', 'saa', 'ipp')
      AND is_authenticated = true
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_user_excomm_in_club(uuid) TO authenticated;

-- Drop the problematic policy
DROP POLICY IF EXISTS "ExComm can add other users to their club" ON app_club_user_relationship;

-- Recreate without recursion using the helper function
CREATE POLICY "ExComm can add other users to their club v2"
  ON app_club_user_relationship
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id != auth.uid() -- Can only add OTHER users
    AND is_user_excomm_in_club(club_id) -- Uses helper function (no recursion)
  );

-- Also fix the UPDATE policy
DROP POLICY IF EXISTS "ExComm can update users in their club" ON app_club_user_relationship;

CREATE POLICY "ExComm can update users in their club v2"
  ON app_club_user_relationship
  FOR UPDATE
  TO authenticated
  USING (is_user_excomm_in_club(club_id))
  WITH CHECK (is_user_excomm_in_club(club_id));
