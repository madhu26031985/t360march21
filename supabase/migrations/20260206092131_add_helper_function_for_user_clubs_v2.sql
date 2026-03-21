/*
  # Add Helper Function for User Clubs (Prevent Recursion)

  ## Problem
  RLS policies that query the same table cause infinite recursion.
  We need club members to see each other, but can't query app_club_user_relationship 
  from within its own SELECT policy.

  ## Solution
  Create a SECURITY DEFINER function that returns a user's club IDs.
  This function bypasses RLS, preventing recursion.
  Then use this function in the SELECT policy.

  ## Security
  - Function only returns clubs for the calling user (auth.uid())
  - SECURITY DEFINER is safe here because it's read-only and user-specific
  - Function is STABLE (result doesn't change within a transaction)
*/

-- Create helper function to get user's club IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_club_ids()
RETURNS TABLE (club_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT club_id
  FROM app_club_user_relationship
  WHERE user_id = auth.uid()
    AND is_authenticated = true;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_club_ids() TO authenticated;

-- Now add back the SELECT policy using the helper function (no recursion!)
CREATE POLICY "Club members can view relationships within their club v2"
  ON app_club_user_relationship
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (SELECT get_user_club_ids())
  );
