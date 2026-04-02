-- Fast attendance load path for web/mobile.
-- 1) Small snapshot for first paint (meeting meta + current user's attendance rows).
-- 2) Full rows fetched on demand (All attendance tab), with sanitized avatars.

CREATE OR REPLACE FUNCTION public._attendance_public_avatar(p_url text)
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

CREATE OR REPLACE FUNCTION public.get_attendance_report_snapshot(
  p_meeting_id uuid
)
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
    'meeting',
    (
      SELECT jsonb_build_object(
        'id', mt.id,
        'meeting_title', mt.meeting_title,
        'meeting_date', mt.meeting_date,
        'meeting_number', mt.meeting_number,
        'meeting_start_time', mt.meeting_start_time,
        'meeting_end_time', mt.meeting_end_time,
        'meeting_mode', mt.meeting_mode,
        'meeting_location', mt.meeting_location,
        'meeting_link', mt.meeting_link,
        'meeting_status', mt.meeting_status
      )
      FROM public.app_club_meeting mt
      WHERE mt.id = p_meeting_id
      LIMIT 1
    ),
    'my_records',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'meeting_id', a.meeting_id,
            'user_id', a.user_id,
            'club_id', a.club_id,
            'user_full_name', a.user_full_name,
            'user_email', a.user_email,
            'user_role', a.user_role,
            'attendance_status', a.attendance_status,
            'attendance_marked_by', a.attendance_marked_by,
            'attendance_marked_at', a.attendance_marked_at,
            'is_attendance_open', a.is_attendance_open,
            'created_at', a.created_at,
            'updated_at', a.updated_at,
            'user_avatar_url', public._attendance_public_avatar(p.avatar_url)
          )
          ORDER BY a.user_full_name
        )
        FROM public.app_meeting_attendance a
        LEFT JOIN public.app_user_profiles p ON p.id = a.user_id
        WHERE a.meeting_id = p_meeting_id
          AND a.user_id = auth.uid()
      ),
      '[]'::jsonb
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_attendance_report_rows(
  p_meeting_id uuid
)
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

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'meeting_id', a.meeting_id,
          'user_id', a.user_id,
          'club_id', a.club_id,
          'user_full_name', a.user_full_name,
          'user_email', a.user_email,
          'user_role', a.user_role,
          'attendance_status', a.attendance_status,
          'attendance_marked_by', a.attendance_marked_by,
          'attendance_marked_at', a.attendance_marked_at,
          'is_attendance_open', a.is_attendance_open,
          'created_at', a.created_at,
          'updated_at', a.updated_at,
          'user_avatar_url', public._attendance_public_avatar(p.avatar_url)
        )
        ORDER BY a.user_full_name
      )
      FROM public.app_meeting_attendance a
      LEFT JOIN public.app_user_profiles p ON p.id = a.user_id
      WHERE a.meeting_id = p_meeting_id
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_attendance_meeting_user_name
  ON public.app_meeting_attendance(meeting_id, user_full_name);

CREATE INDEX IF NOT EXISTS idx_attendance_meeting_user
  ON public.app_meeting_attendance(meeting_id, user_id);

GRANT EXECUTE ON FUNCTION public.get_attendance_report_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_report_rows(uuid) TO authenticated;

ALTER FUNCTION public.get_attendance_report_snapshot(uuid) SET row_security = off;
ALTER FUNCTION public.get_attendance_report_rows(uuid) SET row_security = off;

ANALYZE public.app_meeting_attendance;
