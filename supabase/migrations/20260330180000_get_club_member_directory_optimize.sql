/*
  get_club_member_directory: single membership check (no redundant EXISTS in the row filter),
  then index-friendly scan for roster rows.
*/

CREATE OR REPLACE FUNCTION public.get_club_member_directory(target_club_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  avatar_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.app_club_user_relationship m
    WHERE m.club_id = target_club_id
      AND m.user_id = auth.uid()
      AND m.is_authenticated = true
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.user_id,
    COALESCE(p.full_name, '')::text AS full_name,
    COALESCE(p.email, '')::text AS email,
    p.avatar_url::text AS avatar_url
  FROM public.app_club_user_relationship r
  INNER JOIN public.app_user_profiles p ON p.id = r.user_id
  WHERE r.club_id = target_club_id
    AND r.is_authenticated = true;
END;
$$;

COMMENT ON FUNCTION public.get_club_member_directory(uuid) IS
  'Club members only: list authenticated members with profile fields for assign-TMOD / roster UIs.';

GRANT EXECUTE ON FUNCTION public.get_club_member_directory(uuid) TO authenticated;
