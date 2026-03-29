/*
  Grammarian report screen: one round-trip for meeting + club name + assigned grammarian + VPE flag.

  Club roster stays on get_club_member_directory (separate call, no heavy embed on app_club_user_relationship).
*/

CREATE OR REPLACE FUNCTION public.get_grammarian_corner_snapshot(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  SELECT m.club_id INTO v_club_id
  FROM public.app_club_meeting m
  WHERE m.id = p_meeting_id;

  IF v_club_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_club_user_relationship r
    WHERE r.club_id = v_club_id
      AND r.user_id = auth.uid()
      AND r.is_authenticated = true
  ) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'meeting_id', p_meeting_id,
    'club_id', v_club_id,
    'meeting', (SELECT to_jsonb(mt) FROM public.app_club_meeting mt WHERE mt.id = p_meeting_id),
    'club_name', (SELECT c.name FROM public.clubs c WHERE c.id = v_club_id LIMIT 1),
    'assigned_grammarian',
    (
      SELECT jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'avatar_url', p.avatar_url
      )
      FROM public.app_meeting_roles_management rm
      INNER JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
      WHERE rm.meeting_id = p_meeting_id
        AND rm.booking_status = 'booked'
        AND rm.assigned_user_id IS NOT NULL
        AND lower(rm.role_name) LIKE '%grammarian%'
      ORDER BY rm.role_name
      LIMIT 1
    ),
    'is_vpe_for_club', COALESCE(
      (
        SELECT cp.vpe_id = auth.uid()
        FROM public.club_profiles cp
        WHERE cp.club_id = v_club_id
        LIMIT 1
      ),
      false
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_grammarian_corner_snapshot(uuid) IS
  'Authenticated club members: Grammarian corner header (meeting, club, assigned grammarian, VPE) in one JSON payload.';

GRANT EXECUTE ON FUNCTION public.get_grammarian_corner_snapshot(uuid) TO authenticated;
