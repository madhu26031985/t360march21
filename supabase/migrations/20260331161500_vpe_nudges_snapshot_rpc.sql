/*
  VPE nudges: one snapshot RPC replacing many serial reads.
*/

CREATE OR REPLACE FUNCTION public.get_vpe_nudges_snapshot(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_vpe_id uuid;
  v_club_name text;
  v_meeting_id uuid;
  v_meeting jsonb;
BEGIN
  IF v_uid IS NULL OR p_club_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  SELECT cp.vpe_id, COALESCE(cp.club_name, c.name)
  INTO v_vpe_id, v_club_name
  FROM public.club_profiles cp
  LEFT JOIN public.clubs c ON c.id = cp.club_id
  WHERE cp.club_id = p_club_id
  LIMIT 1;

  IF v_vpe_id IS NULL OR v_vpe_id <> v_uid THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'club_name', COALESCE(v_club_name, 'Our club')
    );
  END IF;

  SELECT m.id,
         to_jsonb(
           (SELECT t FROM (
             SELECT m.id, m.meeting_title, m.meeting_date, m.meeting_number, m.meeting_start_time
           ) t)
         )
  INTO v_meeting_id, v_meeting
  FROM public.app_club_meeting m
  WHERE m.club_id = p_club_id
    AND m.meeting_status = 'open'
    AND m.meeting_date >= (now() at time zone 'utc')::date
  ORDER BY m.meeting_date ASC, m.meeting_start_time ASC
  LIMIT 1;

  IF v_meeting_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'club_name', COALESCE(v_club_name, 'Our club'),
      'meeting', NULL,
      'roles', '[]'::jsonb,
      'prepared_roles', '[]'::jsonb,
      'pathways', '[]'::jsonb,
      'toastmaster_data', '[]'::jsonb,
      'educational_content', NULL,
      'keynote_content', NULL,
      'profiles', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'club_name', COALESCE(v_club_name, 'Our club'),
    'meeting', v_meeting,
    'roles', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'role_name', rm.role_name,
          'role_metric', rm.role_metric,
          'role_classification', rm.role_classification,
          'booking_status', rm.booking_status,
          'assigned_user_id', rm.assigned_user_id
        )
      )
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = v_meeting_id
    ), '[]'::jsonb),
    'prepared_roles', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'role_name', rm.role_name,
          'assigned_user_id', rm.assigned_user_id
        )
      )
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = v_meeting_id
        AND rm.booking_status = 'booked'
        AND rm.assigned_user_id IS NOT NULL
        AND (
          rm.role_classification = 'Prepared Speaker'
          OR rm.role_name ILIKE '%prepared%speaker%'
          OR rm.role_name ILIKE '%ice%breaker%'
        )
    ), '[]'::jsonb),
    'pathways', COALESCE((
      SELECT jsonb_agg(to_jsonb(ep))
      FROM public.app_evaluation_pathway ep
      WHERE ep.meeting_id = v_meeting_id
    ), '[]'::jsonb),
    'toastmaster_data', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'toastmaster_user_id', tmd.toastmaster_user_id,
          'theme_of_the_day', tmd.theme_of_the_day
        )
      )
      FROM public.toastmaster_meeting_data tmd
      WHERE tmd.meeting_id = v_meeting_id
    ), '[]'::jsonb),
    'educational_content', (
      SELECT to_jsonb(s)
      FROM public.app_meeting_educational_speaker s
      WHERE s.meeting_id = v_meeting_id
      ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
      LIMIT 1
    ),
    'keynote_content', (
      SELECT to_jsonb(k)
      FROM public.app_meeting_keynote_speaker k
      WHERE k.meeting_id = v_meeting_id
      ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC
      LIMIT 1
    ),
    'profiles', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name
        )
      )
      FROM public.app_user_profiles p
      WHERE p.id IN (
        SELECT DISTINCT rm.assigned_user_id
        FROM public.app_meeting_roles_management rm
        WHERE rm.meeting_id = v_meeting_id
          AND rm.assigned_user_id IS NOT NULL
        UNION
        SELECT DISTINCT ep.user_id
        FROM public.app_evaluation_pathway ep
        WHERE ep.meeting_id = v_meeting_id
          AND ep.user_id IS NOT NULL
        UNION
        SELECT DISTINCT ep.assigned_evaluator_id
        FROM public.app_evaluation_pathway ep
        WHERE ep.meeting_id = v_meeting_id
          AND ep.assigned_evaluator_id IS NOT NULL
      )
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vpe_nudges_snapshot(uuid) TO authenticated;
