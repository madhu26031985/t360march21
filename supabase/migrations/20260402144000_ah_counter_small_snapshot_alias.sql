-- Ah Counter Corner: small snapshot alias RPC
-- Purpose:
-- - Give the client a new RPC name so it can switch immediately once this migration is applied,
--   even if older environments still have the heavy `get_ah_counter_corner_snapshot`.

CREATE OR REPLACE FUNCTION public.get_ah_counter_corner_snapshot_small(p_meeting_id uuid)
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
      SELECT jsonb_build_object(
        'id', m.id,
        'club_id', m.club_id,
        'meeting_title', m.meeting_title,
        'meeting_date', m.meeting_date,
        'meeting_number', m.meeting_number,
        'meeting_start_time', m.meeting_start_time,
        'meeting_end_time', m.meeting_end_time,
        'meeting_mode', m.meeting_mode,
        'meeting_location', m.meeting_location,
        'meeting_link', m.meeting_link,
        'meeting_status', m.meeting_status
      )
      FROM public.app_club_meeting m
      WHERE m.id = p_meeting_id
      LIMIT 1
    ),
    'assigned_ah_counter', (
      SELECT jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'avatar_url', public._timer_report_public_avatar(p.avatar_url)
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
      SELECT (r.role = 'excomm')
      FROM public.app_club_user_relationship r
      WHERE r.club_id = v_club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
      LIMIT 1
    ), false),
    'is_vpe_for_club', COALESCE((
      SELECT (cp.vpe_id = auth.uid())
      FROM public.club_profiles cp
      WHERE cp.club_id = v_club_id
      LIMIT 1
    ), false),
    'report_rows', '[]'::jsonb,
    'audit_members', '[]'::jsonb,
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

COMMENT ON FUNCTION public.get_ah_counter_corner_snapshot_small(uuid) IS
  'Authenticated club members: small snapshot for Ah Counter (no heavy lists).';

GRANT EXECUTE ON FUNCTION public.get_ah_counter_corner_snapshot_small(uuid) TO authenticated;

