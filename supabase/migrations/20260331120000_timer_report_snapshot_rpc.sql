-- Timer Report: one RPC for initial page load + one for category tab switches.
-- Replaces many parallel PostgREST calls (and heavy relationship embeds).

CREATE OR REPLACE FUNCTION public._timer_report_role_names_for_category(p_category text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(COALESCE(p_category, '')))
    WHEN 'prepared_speaker' THEN ARRAY[
      'Prepared Speaker 1', 'Prepared Speaker 2', 'Prepared Speaker 3', 'Prepared Speaker 4', 'Prepared Speaker 5'
    ]::text[]
    WHEN 'table_topic_speaker' THEN ARRAY[
      'Table Topics Speaker 1', 'Table Topics Speaker 2', 'Table Topics Speaker 3', 'Table Topics Speaker 4',
      'Table Topics Speaker 5', 'Table Topics Speaker 6', 'Table Topics Speaker 7', 'Table Topics Speaker 8',
      'Table Topics Speaker 9', 'Table Topics Speaker 10', 'Table Topics Speaker 11', 'Table Topics Speaker 12'
    ]::text[]
    WHEN 'evaluation' THEN ARRAY[
      'Evaluator 1', 'Evaluator 2', 'Evaluator 3', 'Evaluator 4', 'Evaluator 5'
    ]::text[]
    WHEN 'educational_session' THEN ARRAY['Educational Speaker']::text[]
    ELSE ARRAY[]::text[]
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
                'avatar_url', p.avatar_url
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
            'avatar_url', p.avatar_url
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
    (SELECT to_jsonb(mt) FROM public.app_club_meeting mt WHERE mt.id = p_meeting_id),
    'club_id', v_club_id,
    'member_directory',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'user_id', r.user_id,
            'full_name', COALESCE(p.full_name, ''),
            'email', COALESCE(p.email, ''),
            'avatar_url', p.avatar_url
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
            'avatar_url', p.avatar_url
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
        SELECT jsonb_agg(to_jsonb(tr) ORDER BY tr.recorded_at DESC NULLS LAST)
        FROM public.timer_reports tr
        WHERE tr.meeting_id = p_meeting_id
      ),
      '[]'::jsonb
    ),
    'category_roles', COALESCE(v_bundle->'category_roles', '[]'::jsonb),
    'booked_speakers', COALESCE(v_bundle->'booked_speakers', '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public._timer_report_role_names_for_category(text) IS
  'Internal: role_name list matching app timer-report-details speechCategories.';

COMMENT ON FUNCTION public.get_timer_report_category_bundle(uuid, text) IS
  'Club members: category_roles + booked_speakers for timer report category switch.';

COMMENT ON FUNCTION public.get_timer_report_snapshot(uuid, text) IS
  'Club members: full timer report screen payload in one JSON response.';

GRANT EXECUTE ON FUNCTION public.get_timer_report_snapshot(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_timer_report_category_bundle(uuid, text) TO authenticated;

ALTER FUNCTION public.get_timer_report_snapshot(uuid, text) SET row_security = off;
ALTER FUNCTION public.get_timer_report_category_bundle(uuid, text) SET row_security = off;

ANALYZE public.app_meeting_roles_management;
ANALYZE public.timer_reports;
ANALYZE public.app_timer_selected_members;
