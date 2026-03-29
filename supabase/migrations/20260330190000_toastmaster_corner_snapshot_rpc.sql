/*
  Toastmaster corner: one RPC replaces six parallel PostgREST reads (mobile-friendly).
*/

CREATE OR REPLACE FUNCTION public.get_toastmaster_corner_snapshot(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_tmod_uid uuid;
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

  SELECT rm.assigned_user_id INTO v_tmod_uid
  FROM public.app_meeting_roles_management rm
  WHERE rm.meeting_id = p_meeting_id
    AND lower(rm.role_name) LIKE '%toastmaster%'
    AND rm.role_status = 'Available'
    AND rm.booking_status = 'booked'
  ORDER BY rm.role_name
  LIMIT 1;

  RETURN jsonb_build_object(
    'meeting_id', p_meeting_id,
    'club_id', v_club_id,
    'meeting', (SELECT to_jsonb(mt) FROM public.app_club_meeting mt WHERE mt.id = p_meeting_id),
    'club', (
      SELECT jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'club_number', c.club_number,
        'charter_date', c.charter_date
      )
      FROM public.clubs c
      WHERE c.id = v_club_id
      LIMIT 1
    ),
    'toastmaster_of_day',
    (
      SELECT jsonb_build_object(
        'id', rm.id,
        'role_name', rm.role_name,
        'assigned_user_id', rm.assigned_user_id,
        'booking_status', rm.booking_status,
        'app_user_profiles',
        CASE
          WHEN p.id IS NOT NULL THEN jsonb_build_object(
            'full_name', p.full_name,
            'email', p.email,
            'avatar_url', p.avatar_url
          )
          ELSE NULL
        END
      )
      FROM public.app_meeting_roles_management rm
      LEFT JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
      WHERE rm.meeting_id = p_meeting_id
        AND lower(rm.role_name) LIKE '%toastmaster%'
        AND rm.role_status = 'Available'
        AND rm.booking_status = 'booked'
      ORDER BY rm.role_name
      LIMIT 1
    ),
    'toastmaster_meeting_data',
    (
      SELECT to_jsonb(tmd)
      FROM public.toastmaster_meeting_data tmd
      WHERE tmd.meeting_id = p_meeting_id
        AND tmd.club_id = v_club_id
        AND v_tmod_uid IS NOT NULL
        AND tmd.toastmaster_user_id = v_tmod_uid
      ORDER BY tmd.updated_at DESC NULLS LAST, tmd.created_at DESC
      LIMIT 1
    ),
    'is_excomm', COALESCE(
      (
        SELECT r.role = 'excomm'
        FROM public.app_club_user_relationship r
        WHERE r.club_id = v_club_id
          AND r.user_id = auth.uid()
          AND r.is_authenticated = true
        LIMIT 1
      ),
      false
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

COMMENT ON FUNCTION public.get_toastmaster_corner_snapshot(uuid) IS
  'Authenticated club members: Toastmaster corner (meeting, club, TMOD row, theme row, ExComm/VPE) in one JSON payload.';

GRANT EXECUTE ON FUNCTION public.get_toastmaster_corner_snapshot(uuid) TO authenticated;
