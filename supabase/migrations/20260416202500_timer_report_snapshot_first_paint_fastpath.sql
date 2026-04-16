-- Timer Report first-paint fast path:
-- Add `club_name` and top-level `summary_visible_to_members` to the snapshot payload
-- so the screen does not need extra round-trips during initial hydration.

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
    'club_name',
    COALESCE(
      (
        SELECT c.name
        FROM public.clubs c
        WHERE c.id = v_club_id
        LIMIT 1
      ),
      ''
    ),
    'member_directory',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'user_id', r.user_id,
            'full_name', COALESCE(p.full_name, ''),
            'email', COALESCE(p.email, ''),
            'avatar_url', public._timer_report_public_avatar(p.avatar_url),
            'club_role', COALESCE(r.role::text, '')
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
    'summary_visible_to_members',
    COALESCE(
      (
        SELECT t.summary_visible_to_members
        FROM public.timer_reports t
        WHERE t.meeting_id = p_meeting_id
          AND t.summary_visible_to_members IS NOT NULL
        ORDER BY t.recorded_at DESC NULLS LAST
        LIMIT 1
      ),
      true
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
            'visiting_guest_id', tr.visiting_guest_id,
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
            'updated_at', tr.updated_at,
            'summary_visible_to_members', tr.summary_visible_to_members
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
    'visiting_guests', public._meeting_visiting_guests_json(p_meeting_id),
    'category_roles', COALESCE(v_bundle->'category_roles', '[]'::jsonb),
    'booked_speakers', COALESCE(v_bundle->'booked_speakers', '[]'::jsonb)
  );
END;
$$;
