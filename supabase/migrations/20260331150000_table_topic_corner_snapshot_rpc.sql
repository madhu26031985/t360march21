/*
  Table Topic Corner: collapse multiple reads into one snapshot RPC.
*/

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
    'meeting', (
      SELECT to_jsonb(m)
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
            'avatar_url', p.avatar_url
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
              'avatar_url', p.avatar_url
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
    'assigned_questions', COALESCE((
      SELECT jsonb_agg(to_jsonb(tt) ORDER BY tt.created_at)
      FROM public.app_meeting_tabletopicscorner tt
      WHERE tt.meeting_id = p_meeting_id
        AND tt.booking_status = 'booked'
        AND tt.is_active = true
    ), '[]'::jsonb),
    'published_questions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', tt.id,
          'meeting_id', tt.meeting_id,
          'participant_id', tt.participant_id,
          'participant_name', tt.participant_name,
          'question_text', tt.question_text,
          'asked_by', tt.asked_by,
          'asked_by_name', tt.asked_by_name,
          'created_at', tt.created_at,
          'updated_at', tt.updated_at,
          'participant_avatar', p.avatar_url
        )
        ORDER BY tt.created_at
      )
      FROM public.app_meeting_tabletopicscorner tt
      LEFT JOIN public.app_user_profiles p ON p.id = tt.participant_id
      WHERE tt.meeting_id = p_meeting_id
        AND tt.club_id = v_club_id
        AND tt.is_active = true
        AND tt.is_published = true
    ), '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.get_table_topic_corner_snapshot(uuid) IS
  'Authenticated club members: Table Topic Corner snapshot (meeting, club info, TT master, participants, assigned and published questions) in one JSON payload.';

GRANT EXECUTE ON FUNCTION public.get_table_topic_corner_snapshot(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_tt_corner_meeting_active
  ON public.app_meeting_tabletopicscorner (meeting_id, is_active);

CREATE INDEX IF NOT EXISTS idx_tt_corner_meeting_published
  ON public.app_meeting_tabletopicscorner (meeting_id, club_id, is_active, is_published);

CREATE INDEX IF NOT EXISTS idx_tt_corner_meeting_booked
  ON public.app_meeting_tabletopicscorner (meeting_id, booking_status, is_active);

ANALYZE public.app_meeting_tabletopicscorner;
