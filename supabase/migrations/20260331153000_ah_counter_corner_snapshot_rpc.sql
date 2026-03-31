/*
  Ah Counter Corner: single snapshot payload to reduce first-load round trips.
*/

CREATE OR REPLACE FUNCTION public.get_ah_counter_corner_snapshot(p_meeting_id uuid)
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
    'meeting', (
      SELECT to_jsonb(m)
      FROM public.app_club_meeting m
      WHERE m.id = p_meeting_id
      LIMIT 1
    ),
    'assigned_ah_counter', (
      SELECT jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'avatar_url', p.avatar_url
      )
      FROM public.app_meeting_roles_management rm
      JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
      WHERE rm.meeting_id = p_meeting_id
        AND rm.role_name ILIKE '%Ah Counter%'
        AND rm.booking_status = 'booked'
        AND rm.assigned_user_id IS NOT NULL
      ORDER BY rm.role_name
      LIMIT 1
    ),
    'report_stats', jsonb_build_object(
      'total_speakers', COALESCE((
        SELECT count(*)
        FROM public.app_meeting_attendance a
        WHERE a.meeting_id = p_meeting_id
          AND a.club_id = v_club_id
          AND a.attendance_status IN ('present', 'late')
      ), 0),
      'completed_reports', COALESCE((
        SELECT count(*)
        FROM public.ah_counter_reports ar
        WHERE ar.meeting_id = p_meeting_id
          AND ar.club_id = v_club_id
          AND ar.is_published = true
      ), 0),
      'selected_members', COALESCE((
        SELECT count(*)
        FROM public.ah_counter_tracked_members tm
        WHERE tm.meeting_id = p_meeting_id
          AND tm.club_id = v_club_id
      ), 0)
    ),
    'is_excomm', COALESCE((
      SELECT r.role = 'excomm'
      FROM public.app_club_user_relationship r
      WHERE r.club_id = v_club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
      LIMIT 1
    ), false),
    'is_vpe_for_club', COALESCE((
      SELECT cp.vpe_id = auth.uid()
      FROM public.club_profiles cp
      WHERE cp.club_id = v_club_id
      LIMIT 1
    ), false),
    'report_rows', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(ar) || jsonb_build_object(
          'app_user_profiles',
          CASE
            WHEN p.id IS NOT NULL THEN jsonb_build_object('avatar_url', p.avatar_url)
            ELSE NULL
          END
        )
      )
      FROM public.ah_counter_reports ar
      LEFT JOIN public.app_user_profiles p ON p.id = ar.speaker_user_id
      WHERE ar.meeting_id = p_meeting_id
        AND ar.club_id = v_club_id
    ), '[]'::jsonb),
    'audit_members', COALESCE((
      WITH tracked AS (
        SELECT tm.user_id
        FROM public.ah_counter_tracked_members tm
        WHERE tm.meeting_id = p_meeting_id
          AND tm.club_id = v_club_id
          AND COALESCE(tm.is_unavailable, false) = false
      ),
      tracked_count AS (
        SELECT count(*) AS c FROM tracked
      ),
      source_ids AS (
        SELECT t.user_id
        FROM tracked t
        WHERE (SELECT c FROM tracked_count) > 0
        UNION ALL
        SELECT r.user_id
        FROM public.app_club_user_relationship r
        WHERE (SELECT c FROM tracked_count) = 0
          AND r.club_id = v_club_id
          AND r.is_authenticated = true
      )
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        )
        ORDER BY p.full_name
      )
      FROM source_ids s
      JOIN public.app_user_profiles p ON p.id = s.user_id
    ), '[]'::jsonb),
    'published_count', COALESCE((
      SELECT count(*)
      FROM public.ah_counter_reports ar
      WHERE ar.meeting_id = p_meeting_id
        AND ar.club_id = v_club_id
        AND ar.is_published = true
    ), 0),
    'total_reports', COALESCE((
      SELECT count(*)
      FROM public.ah_counter_reports ar
      WHERE ar.meeting_id = p_meeting_id
        AND ar.club_id = v_club_id
    ), 0)
  );
END;
$$;

COMMENT ON FUNCTION public.get_ah_counter_corner_snapshot(uuid) IS
  'Authenticated club members: Ah Counter corner snapshot (meeting, assignment, stats, audit members, report rows, role flags).';

GRANT EXECUTE ON FUNCTION public.get_ah_counter_corner_snapshot(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_meeting_club
  ON public.ah_counter_reports (meeting_id, club_id);

CREATE INDEX IF NOT EXISTS idx_ah_counter_tracked_meeting_club
  ON public.ah_counter_tracked_members (meeting_id, club_id, is_unavailable);

ANALYZE public.ah_counter_reports;
ANALYZE public.ah_counter_tracked_members;
