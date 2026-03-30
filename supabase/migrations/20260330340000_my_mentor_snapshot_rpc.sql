-- My Mentor performance snapshot:
-- - One RPC round-trip for mentor + VPE contact + club name
-- - Index tuned for active mentor lookup by club+mentee

CREATE INDEX IF NOT EXISTS idx_mentor_assignments_active_club_mentee
  ON public.mentor_assignments (club_id, mentee_id)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.get_my_mentor_snapshot(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_club_name text := 'Your Club';
  v_vpe_id uuid;
BEGIN
  IF v_uid IS NULL OR p_club_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_club_user_relationship r
    WHERE r.club_id = p_club_id
      AND r.user_id = v_uid
      AND r.is_authenticated = true
  ) THEN
    RETURN NULL;
  END IF;

  SELECT c.name, cp.vpe_id
  INTO v_club_name, v_vpe_id
  FROM public.clubs c
  LEFT JOIN public.club_profiles cp ON cp.club_id = c.id
  WHERE c.id = p_club_id;

  RETURN jsonb_build_object(
    'club_name', COALESCE(v_club_name, 'Your Club'),
    'mentor',
    (
      SELECT
        CASE
          WHEN up.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', up.id,
            'full_name', up.full_name,
            'email', up.email,
            'phone_number', up.phone_number,
            'avatar_url', up.avatar_url
          )
        END
      FROM public.mentor_assignments ma
      LEFT JOIN public.app_user_profiles up ON up.id = ma.mentor_id
      WHERE ma.club_id = p_club_id
        AND ma.mentee_id = v_uid
        AND ma.status = 'active'
      ORDER BY ma.updated_at DESC
      LIMIT 1
    ),
    'vpe',
    (
      SELECT
        CASE
          WHEN vp.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', vp.id,
            'full_name', vp.full_name,
            'phone_number', vp.phone_number
          )
        END
      FROM public.app_user_profiles vp
      WHERE vp.id = v_vpe_id
      LIMIT 1
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_mentor_snapshot(uuid) TO authenticated;

ANALYZE public.mentor_assignments;
