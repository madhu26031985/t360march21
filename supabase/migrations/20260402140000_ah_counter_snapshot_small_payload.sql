-- Ah Counter Corner: <1s first paint
-- Strategy:
-- - Shrink snapshot payload to only what the initial screen needs.
-- - Move heavy lists (audit members + report rows) behind dedicated RPCs.
-- - Sanitize avatar_url to avoid base64 / huge strings.

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
-- Reuse existing avatar sanitizer if available (created by timer snapshot migrations).
-- If it doesn't exist in your DB yet, create a compatible copy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = '_timer_report_public_avatar'
      AND pg_function_is_visible(oid)
  ) THEN
    EXECUTE $SQL$
      CREATE OR REPLACE FUNCTION public._timer_report_public_avatar(p_url text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      SET search_path = public
      AS $fn$
        SELECT CASE
          WHEN p_url IS NULL THEN NULL
          WHEN left(p_url, 5) = 'data:' THEN NULL
          WHEN length(p_url) > 2048 THEN NULL
          ELSE p_url
        END;
      $fn$;
    $SQL$;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1) Small snapshot RPC (no heavy arrays)
-- ------------------------------------------------------------
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
    -- Heavy arrays are fetched on-demand (tab open)
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

COMMENT ON FUNCTION public.get_ah_counter_corner_snapshot(uuid) IS
  'Authenticated club members: Ah Counter corner small snapshot (meeting, assignment, stats, role flags). Heavy lists fetched separately.';

GRANT EXECUTE ON FUNCTION public.get_ah_counter_corner_snapshot(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 2) Audit members RPC (single call)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ah_counter_audit_members(p_meeting_id uuid)
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

  RETURN COALESCE((
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
        'avatar_url', public._timer_report_public_avatar(p.avatar_url)
      )
      ORDER BY p.full_name
    )
    FROM (SELECT DISTINCT user_id FROM source_ids) s
    JOIN public.app_user_profiles p ON p.id = s.user_id
  ), '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_ah_counter_audit_members(uuid) IS
  'Authenticated club members: audit member list for Ah Counter (tracked members if configured, else full club directory).';

GRANT EXECUTE ON FUNCTION public.get_ah_counter_audit_members(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 3) Report rows RPC (single call, minimal columns)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ah_counter_report_rows(p_meeting_id uuid)
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

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ar.id,
        'speaker_user_id', ar.speaker_user_id,
        'speaker_name', ar.speaker_name,
        'ah_count', ar.ah_count,
        'um_count', ar.um_count,
        'uh_count', ar.uh_count,
        'er_count', ar.er_count,
        'hmm_count', ar.hmm_count,
        'like_count', ar.like_count,
        'so_count', ar.so_count,
        'well_count', ar.well_count,
        'okay_count', ar.okay_count,
        'you_know_count', ar.you_know_count,
        'right_count', ar.right_count,
        'actually_count', ar.actually_count,
        'basically_count', ar.basically_count,
        'literally_count', ar.literally_count,
        'i_mean_count', ar.i_mean_count,
        'you_see_count', ar.you_see_count,
        'app_user_profiles',
          CASE
            WHEN p.id IS NOT NULL THEN jsonb_build_object(
              'avatar_url', public._timer_report_public_avatar(p.avatar_url)
            )
            ELSE NULL
          END
      )
      ORDER BY ar.speaker_name
    )
    FROM public.ah_counter_reports ar
    LEFT JOIN public.app_user_profiles p ON p.id = ar.speaker_user_id
    WHERE ar.meeting_id = p_meeting_id
      AND ar.club_id = v_club_id
  ), '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_ah_counter_report_rows(uuid) IS
  'Authenticated club members: Ah Counter report rows (minimal columns + avatar).';

GRANT EXECUTE ON FUNCTION public.get_ah_counter_report_rows(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Indexes for <1s response on slow networks
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_published
  ON public.ah_counter_reports (meeting_id, club_id)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting_club_status
  ON public.app_meeting_attendance (meeting_id, club_id, attendance_status);

ANALYZE public.ah_counter_reports;
ANALYZE public.ah_counter_tracked_members;
ANALYZE public.app_meeting_attendance;

