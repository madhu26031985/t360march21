/*
  # Create function to get user's mentor

  1. New Function
    - `get_my_mentor(p_club_id uuid)` - Returns mentor details for the current user
    - Checks mentor_assignments for active assignments
    - Returns mentor profile information
    
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only returns data for the authenticated user (auth.uid())
    - Checks that user has access to the specified club
*/

CREATE OR REPLACE FUNCTION get_my_mentor(p_club_id uuid)
RETURNS TABLE (
  mentor_id uuid,
  full_name text,
  email text,
  phone_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the user has access to this club
  IF NOT EXISTS (
    SELECT 1 FROM app_club_user_relationship
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND is_authenticated = true
  ) THEN
    RAISE EXCEPTION 'Access denied to club';
  END IF;

  -- Return mentor details
  RETURN QUERY
  SELECT 
    up.id,
    up.full_name,
    up.email,
    up.phone_number
  FROM mentor_assignments ma
  JOIN app_user_profiles up ON ma.mentor_id = up.id
  WHERE ma.mentee_id = auth.uid()
    AND ma.club_id = p_club_id
    AND ma.status = 'active'
  LIMIT 1;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_my_mentor(uuid) TO authenticated;
