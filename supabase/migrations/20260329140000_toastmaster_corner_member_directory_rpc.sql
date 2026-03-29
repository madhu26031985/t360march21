/*
  Toastmaster Corner / club roster performance

  - Partial index for "authenticated members of club" scans + join to profiles.
  - SECURITY DEFINER RPC returns member directory in one round-trip with a single
    membership check (avoids per-row RLS + PostgREST embed overhead on large clubs).
*/

-- Narrow partial index: roster queries filter club_id + is_authenticated = true
CREATE INDEX IF NOT EXISTS idx_acur_club_authenticated_user
  ON public.app_club_user_relationship (club_id, user_id)
  WHERE is_authenticated = true;

ANALYZE public.app_club_user_relationship;
ANALYZE public.app_user_profiles;

CREATE OR REPLACE FUNCTION public.get_club_member_directory(target_club_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.user_id,
    COALESCE(p.full_name, '')::text AS full_name,
    COALESCE(p.email, '')::text AS email,
    p.avatar_url::text AS avatar_url
  FROM public.app_club_user_relationship r
  INNER JOIN public.app_user_profiles p ON p.id = r.user_id
  WHERE r.club_id = target_club_id
    AND r.is_authenticated = true
    AND EXISTS (
      SELECT 1
      FROM public.app_club_user_relationship m
      WHERE m.club_id = target_club_id
        AND m.user_id = auth.uid()
        AND m.is_authenticated = true
    );
$$;

COMMENT ON FUNCTION public.get_club_member_directory(uuid) IS
  'Club members only: list authenticated members with profile fields for assign-TMOD / roster UIs.';

GRANT EXECUTE ON FUNCTION public.get_club_member_directory(uuid) TO authenticated;
