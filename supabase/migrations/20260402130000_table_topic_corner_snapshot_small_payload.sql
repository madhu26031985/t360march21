-- Optimize Table Topic Corner snapshot payload:
-- - Shrink `published_questions` items to only `{ id }` (screen uses only `.length`).
-- - Drop `assigned_questions` from snapshot (initial UI doesn't use it; it is loaded on-demand after actions).
-- - Limit `meeting` object to fields used by the frontend.
-- - Avoid huge avatar payloads by stripping data URLs / absurdly long strings.
-- - Include `is_vpe` so the frontend doesn't need an extra club_profiles query.

CREATE OR REPLACE FUNCTION public.get_table_topic_corner_snapshot(p_meeting_id uuid)
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
    'is_vpe', (
      SELECT (cp.vpe_id = auth.uid())
      FROM public.club_profiles cp
      WHERE cp.club_id = v_club_id
      LIMIT 1
    ),
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
    'club_info', (
      SELECT jsonb_build_object(
        'name', c.name,
        'club_number', c.club_number,
        'banner_color', cp.banner_color
      )
      FROM public.clubs c
      LEFT JOIN public.club_profiles cp ON cp.club_id = c.id
      WHERE c.id = v_club_id
      LIMIT 1
    ),
    'table_topic_master', (
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
            'avatar_url', public._timer_report_public_avatar(p.avatar_url)
          )
          ELSE NULL
        END
      )
      FROM public.app_meeting_roles_management rm
      LEFT JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
      WHERE rm.meeting_id = p_meeting_id
        AND (
          rm.role_name ILIKE '%Table Topics Master%'
          OR rm.role_name ILIKE '%Table Topic Master%'
        )
        AND rm.role_status = 'Available'
        AND rm.booking_status = 'booked'
        AND rm.assigned_user_id IS NOT NULL
      ORDER BY rm.role_name
      LIMIT 1
    ),
    'participants', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', rm.id,
          'role_name', rm.role_name,
          'assigned_user_id', rm.assigned_user_id,
          'booking_status', rm.booking_status,
          'order_index', rm.order_index,
          'app_user_profiles',
          CASE
            WHEN p.id IS NOT NULL THEN jsonb_build_object(
              'full_name', p.full_name,
              'email', p.email,
              'avatar_url', public._timer_report_public_avatar(p.avatar_url)
            )
            ELSE NULL
          END
        )
        ORDER BY rm.order_index
      )
      FROM public.app_meeting_roles_management rm
      LEFT JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
      WHERE rm.meeting_id = p_meeting_id
        AND (
          rm.role_name ILIKE '%Table Topics Speaker%'
          OR rm.role_name ILIKE '%Table Topic Speaker%'
          OR rm.role_name ILIKE '%Table Topics Participant%'
          OR rm.role_name ILIKE '%Table Topic Participant%'
        )
        AND rm.role_status = 'Available'
    ), '[]'::jsonb),
    -- Initial screen only needs the count of published questions.
    -- We therefore avoid returning full question rows (question_text can be large).
    'assigned_questions', '[]'::jsonb,
    'published_questions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', tt.id
        )
        ORDER BY tt.created_at
      )
      FROM public.app_meeting_tabletopicscorner tt
      WHERE tt.meeting_id = p_meeting_id
        AND tt.club_id = v_club_id
        AND tt.is_active = true
        AND tt.is_published = true
    ), '[]'::jsonb)
  );
END;
$$;

