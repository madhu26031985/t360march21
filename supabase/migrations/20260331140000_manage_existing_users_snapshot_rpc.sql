-- Manage Existing Users: one tight round-trip instead of PostgREST embed on app_club_user_relationship.
-- Drops data: avatars and absurdly long URLs (same idea as timer snapshot) to avoid multi-MB JSON.

CREATE OR REPLACE FUNCTION public._manage_users_public_avatar(p_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_url IS NULL THEN NULL
    WHEN left(p_url, 5) = 'data:' THEN NULL
    WHEN length(p_url) > 2048 THEN NULL
    ELSE p_url
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_manage_existing_users_rows(target_club_id uuid)
RETURNS TABLE (
  club_user_id uuid,
  user_id uuid,
  club_id uuid,
  role text,
  is_authenticated boolean,
  created_at timestamptz,
  full_name text,
  email text,
  avatar_url text,
  is_active boolean
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
    r.id,
    r.user_id,
    r.club_id,
    r.role::text,
    r.is_authenticated,
    r.created_at,
    COALESCE(p.full_name, '')::text,
    COALESCE(p.email, '')::text,
    public._manage_users_public_avatar(p.avatar_url::text),
    COALESCE(p.is_active, true)
  FROM public.app_club_user_relationship r
  INNER JOIN public.app_user_profiles p ON p.id = r.user_id
  WHERE r.club_id = target_club_id
    AND r.is_authenticated = true
  ORDER BY r.created_at DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_manage_existing_users_rows(uuid) IS
  'Authenticated club members: slim roster for Manage Existing Users (minimal columns + safe avatar URLs).';

GRANT EXECUTE ON FUNCTION public.get_manage_existing_users_rows(uuid) TO authenticated;
