/*
  General Evaluator Report: one RPC replaces meeting + club + club_profiles + GE role + app_meeting_ge
  (cuts multiple round-trips on slow networks).
*/

CREATE OR REPLACE FUNCTION public.get_general_evaluator_report_snapshot(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_ge_uid uuid;
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

  SELECT rm.assigned_user_id INTO v_ge_uid
  FROM public.app_meeting_roles_management rm
  WHERE rm.meeting_id = p_meeting_id
    AND lower(rm.role_name) LIKE '%general evaluator%'
    AND rm.role_status = 'Available'
    AND rm.booking_status = 'booked'
  ORDER BY rm.role_name
  LIMIT 1;

  RETURN jsonb_build_object(
    'club_id', v_club_id,
    'meeting', (SELECT to_jsonb(m) FROM public.app_club_meeting m WHERE m.id = p_meeting_id),
    'club', (
      SELECT jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'club_number', c.club_number
      )
      FROM public.clubs c
      WHERE c.id = v_club_id
      LIMIT 1
    ),
    'is_vpe_for_club', COALESCE(
      (
        SELECT (cp.vpe_id IS NOT NULL AND cp.vpe_id = auth.uid())
        FROM public.club_profiles cp
        WHERE cp.club_id = v_club_id
        LIMIT 1
      ),
      false
    ),
    'general_evaluator', (
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
        AND lower(rm.role_name) LIKE '%general evaluator%'
        AND rm.role_status = 'Available'
        AND rm.booking_status = 'booked'
      ORDER BY rm.role_name
      LIMIT 1
    ),
    'ge_report', (
      SELECT to_jsonb(g)
      FROM public.app_meeting_ge g
      WHERE g.meeting_id = p_meeting_id
        AND v_ge_uid IS NOT NULL
        AND g.evaluator_user_id = v_ge_uid
      LIMIT 1
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_general_evaluator_report_snapshot(uuid) IS
  'GE report screen: meeting, club, VPE flag, booked GE role + profile, GE evaluation row (one round-trip).';

GRANT EXECUTE ON FUNCTION public.get_general_evaluator_report_snapshot(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_app_meeting_ge_meeting_evaluator
  ON public.app_meeting_ge (meeting_id, evaluator_user_id);
