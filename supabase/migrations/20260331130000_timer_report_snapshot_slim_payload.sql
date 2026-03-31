-- Timer report snapshot: shrink JSON over the wire (fixes multi‑MB responses on slow networks).
-- - Meeting: only fields the Timer screen uses (not full to_jsonb row).
-- - Avatars: drop data: URLs and absurdly long strings (common source of 1MB+ payloads).
-- - timer_reports: explicit columns (same as client TimerReport + updated_at), not to_jsonb row.

CREATE OR REPLACE FUNCTION public._timer_report_public_avatar(p_url text)
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

CREATE OR REPLACE FUNCTION public.get_timer_report_category_bundle(
  p_meeting_id uuid,
  p_speech_category text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_roles text[];
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

  v_roles := public._timer_report_role_names_for_category(p_speech_category);

  IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'category_roles', '[]'::jsonb,
      'booked_speakers', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'category_roles',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', rm.id,
            'role_name', rm.role_name,
            'booking_status', rm.booking_status,
            'assigned_user_id', rm.assigned_user_id,
            'completion_notes', rm.completion_notes,
            'app_user_profiles',
            CASE
              WHEN p.id IS NOT NULL THEN jsonb_build_object(
                'id', p.id,
                'full_name', p.full_name,
                'email', p.email,
                'avatar_url', public._timer_report_public_avatar(p.avatar_url)
              )
              ELSE NULL
            END
          )
          ORDER BY rm.role_name
        )
        FROM public.app_meeting_roles_management rm
        LEFT JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
        WHERE rm.meeting_id = p_meeting_id
          AND rm.role_name = ANY (v_roles)
      ),
      '[]'::jsonb
    ),
    'booked_speakers',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'email', p.email,
            'avatar_url', public._timer_report_public_avatar(p.avatar_url)
          )
          ORDER BY p.full_name
        )
        FROM (
          SELECT DISTINCT rm.assigned_user_id AS uid
          FROM public.app_meeting_roles_management rm
          WHERE rm.meeting_id = p_meeting_id
            AND rm.role_name = ANY (v_roles)
            AND rm.booking_status = 'booked'
            AND rm.assigned_user_id IS NOT NULL
        ) u
        INNER JOIN public.app_user_profiles p ON p.id = u.uid
      ),
      '[]'::jsonb
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_timer_report_snapshot(
  p_meeting_id uuid,
  p_speech_category text DEFAULT 'prepared_speaker'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_bundle jsonb;
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

  v_bundle := public.get_timer_report_category_bundle(p_meeting_id, p_speech_category);

  RETURN jsonb_build_object(
    'meeting',
    (
      SELECT jsonb_build_object(
        'id', mt.id,
        'club_id', mt.club_id,
        'meeting_title', mt.meeting_title,
        'meeting_date', mt.meeting_date,
        'meeting_number', mt.meeting_number,
        'meeting_start_time', mt.meeting_start_time,
        'meeting_end_time', mt.meeting_end_time,
        'meeting_mode', mt.meeting_mode,
        'meeting_status', mt.meeting_status
      )
      FROM public.app_club_meeting mt
      WHERE mt.id = p_meeting_id
    ),
    'club_id', v_club_id,
    'member_directory',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'user_id', r.user_id,
            'full_name', COALESCE(p.full_name, ''),
            'email', COALESCE(p.email, ''),
            'avatar_url', public._timer_report_public_avatar(p.avatar_url)
          )
          ORDER BY COALESCE(p.full_name, '')
        )
        FROM public.app_club_user_relationship r
        INNER JOIN public.app_user_profiles p ON p.id = r.user_id
        WHERE r.club_id = v_club_id
          AND r.is_authenticated = true
      ),
      '[]'::jsonb
    ),
    'selected_member_ids',
    COALESCE(
      (
        SELECT jsonb_agg(tsm.selected_member_id ORDER BY tsm.selected_member_id)
        FROM public.app_timer_selected_members tsm
        WHERE tsm.meeting_id = p_meeting_id
          AND tsm.timer_user_id = auth.uid()
      ),
      '[]'::jsonb
    ),
    'assigned_timer',
    (
      SELECT
        CASE
          WHEN p.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'email', p.email,
            'avatar_url', public._timer_report_public_avatar(p.avatar_url)
          )
        END
      FROM public.app_meeting_roles_management rm
      INNER JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
      WHERE rm.meeting_id = p_meeting_id
        AND rm.role_name = 'Timer'
        AND rm.booking_status = 'booked'
      LIMIT 1
    ),
    'is_vpe',
    COALESCE(
      (
        SELECT (cp.vpe_id IS NOT NULL AND cp.vpe_id = auth.uid())
        FROM public.club_profiles cp
        WHERE cp.club_id = v_club_id
        LIMIT 1
      ),
      false
    ),
    'timer_reports',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', tr.id,
            'meeting_id', tr.meeting_id,
            'club_id', tr.club_id,
            'speaker_name', tr.speaker_name,
            'speaker_user_id', tr.speaker_user_id,
            'speech_category', tr.speech_category,
            'actual_time_seconds', tr.actual_time_seconds,
            'actual_time_display', tr.actual_time_display,
            'time_qualification', tr.time_qualification,
            'target_min_seconds', tr.target_min_seconds,
            'target_max_seconds', tr.target_max_seconds,
            'notes', tr.notes,
            'recorded_by', tr.recorded_by,
            'recorded_at', tr.recorded_at,
            'created_at', tr.created_at,
            'updated_at', tr.updated_at
          )
          ORDER BY tr.recorded_at DESC NULLS LAST
        )
        FROM (
          SELECT t.*
          FROM public.timer_reports t
          WHERE t.meeting_id = p_meeting_id
          ORDER BY t.recorded_at DESC NULLS LAST
          LIMIT 3000
        ) tr
      ),
      '[]'::jsonb
    ),
    'category_roles', COALESCE(v_bundle->'category_roles', '[]'::jsonb),
    'booked_speakers', COALESCE(v_bundle->'booked_speakers', '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public._timer_report_public_avatar(text) IS
  'Strip inline data URLs and oversized avatar strings from timer snapshot JSON.';
