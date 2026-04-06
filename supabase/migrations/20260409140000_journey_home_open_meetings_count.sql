-- Journey Home: include count of meetings with meeting_status = 'open' (VPE planning nudge on My Tasks).

CREATE OR REPLACE FUNCTION public.get_journey_home_snapshot(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cutoff date;
  v_open jsonb;
  v_stats jsonb;
  v_vpe_id uuid;
  v_is_vpe boolean;
  v_has_poll boolean;
  v_has_voted boolean;
  v_open_meetings_count int;
BEGIN
  IF v_uid IS NULL THEN
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

  v_cutoff := (CURRENT_TIMESTAMP - interval '4 hours')::date;

  SELECT count(*)::int
  INTO v_open_meetings_count
  FROM public.app_club_meeting m
  WHERE m.club_id = p_club_id
    AND m.meeting_status = 'open';

  SELECT to_jsonb(p)
  INTO v_open
  FROM (
    SELECT
      c.id,
      c.meeting_title,
      c.meeting_date::text AS meeting_date,
      c.meeting_start_time::text AS meeting_start_time,
      c.meeting_end_time::text AS meeting_end_time,
      c.meeting_mode
    FROM (
      SELECT
        m.id,
        m.meeting_title,
        m.meeting_date,
        m.meeting_start_time,
        m.meeting_end_time,
        m.meeting_mode,
        (
          m.meeting_date
          + COALESCE(
              NULLIF(trim(both FROM coalesce(m.meeting_end_time::text, '')), '')::time,
              TIME '23:59:59'
            )
        ) AS end_ts
      FROM public.app_club_meeting m
      WHERE m.club_id = p_club_id
        AND m.meeting_status = 'open'
        AND m.meeting_date >= v_cutoff
      ORDER BY m.meeting_date ASC
      LIMIT 5
    ) c
    WHERE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - c.end_ts)) / 3600.0 < 4
    ORDER BY c.meeting_date ASC
    LIMIT 1
  ) p;

  SELECT jsonb_build_object(
    'meeting_attended_count', COALESCE(count(DISTINCT r.meeting_id), 0)::int,
    'roles_completed_count', COALESCE(count(*), 0)::int,
    'speeches_given_count', COALESCE(sum(
      CASE
        WHEN r.role_classification = 'Prepared Speaker' THEN 1
        WHEN lower(coalesce(r.role_name, '')) LIKE '%prepared%' AND lower(coalesce(r.role_name, '')) LIKE '%speaker%' THEN 1
        WHEN lower(coalesce(r.role_name, '')) LIKE '%ice%' AND lower(coalesce(r.role_name, '')) LIKE '%breaker%' THEN 1
        ELSE 0
      END
    ), 0)::int,
    'evaluations_given_count', COALESCE(sum(
      CASE
        WHEN r.role_classification IN ('Speech evaluvator', 'Master evaluvator', 'speech_evaluator') THEN 1
        ELSE 0
      END
    ), 0)::int
  )
  INTO v_stats
  FROM public.app_meeting_roles_management r
  WHERE r.club_id = p_club_id
    AND r.assigned_user_id = v_uid
    AND r.booking_status = 'booked';

  SELECT cp.vpe_id
  INTO v_vpe_id
  FROM public.club_profiles cp
  WHERE cp.club_id = p_club_id
  LIMIT 1;

  v_is_vpe := (v_vpe_id IS NOT NULL AND v_vpe_id = v_uid);

  SELECT EXISTS (
    SELECT 1
    FROM public.polls pl
    WHERE pl.club_id = p_club_id
      AND pl.status = 'published'
  )
  INTO v_has_poll;

  SELECT EXISTS (
    SELECT 1
    FROM public.simple_poll_votes v
    INNER JOIN public.polls pl ON pl.id = v.poll_id
    WHERE pl.club_id = p_club_id
      AND pl.status = 'published'
      AND v.user_id = v_uid
  )
  INTO v_has_voted;

  RETURN jsonb_build_object(
    'club_id', p_club_id,
    'open_meeting', v_open,
    'open_meetings_count', COALESCE(v_open_meetings_count, 0),
    'journey_stats', COALESCE(v_stats, jsonb_build_object(
      'meeting_attended_count', 0,
      'roles_completed_count', 0,
      'speeches_given_count', 0,
      'evaluations_given_count', 0
    )),
    'is_vpe_for_club', v_is_vpe,
    'has_active_poll', COALESCE(v_has_poll, false),
    'has_voted_in_active_poll', COALESCE(v_has_voted, false)
  );
END;
$$;

COMMENT ON FUNCTION public.get_journey_home_snapshot(uuid) IS
  'Authenticated club members: Journey Home header stats, current open meeting, count of open-status meetings (VPE planning), VPE match, poll flags in one JSON payload.';
