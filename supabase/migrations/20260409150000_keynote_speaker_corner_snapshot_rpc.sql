/*
  Keynote Speaker Corner: one RPC replaces parallel PostgREST reads
  (meeting + club name + booked keynote row + profile + keynote content + VPE flag).
  Avoids wide table scans and large embed payloads from the client.
*/

CREATE INDEX IF NOT EXISTS idx_mrm_meeting_keynote_booked_available
  ON public.app_meeting_roles_management (meeting_id)
  WHERE role_status = 'Available'
    AND booking_status = 'booked'
    AND (
      role_classification IN ('Keynote speaker', 'Keynote speakers')
      OR lower(role_name) LIKE '%keynote%'
    );

CREATE OR REPLACE FUNCTION public.get_keynote_speaker_corner_snapshot(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_assigned uuid;
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

  SELECT rm.assigned_user_id INTO v_assigned
  FROM public.app_meeting_roles_management rm
  WHERE rm.meeting_id = p_meeting_id
    AND rm.role_status = 'Available'
    AND rm.booking_status = 'booked'
    AND lower(rm.role_name) LIKE '%keynote%'
  ORDER BY rm.role_name
  LIMIT 1;

  RETURN jsonb_build_object(
    'meeting_id', p_meeting_id,
    'club_id', v_club_id,
    'meeting', (
      SELECT jsonb_build_object(
        'id', m.id,
        'meeting_title', m.meeting_title,
        'meeting_date', m.meeting_date,
        'meeting_number', m.meeting_number,
        'meeting_start_time', m.meeting_start_time,
        'meeting_end_time', m.meeting_end_time,
        'meeting_mode', m.meeting_mode,
        'meeting_location', m.meeting_location,
        'meeting_link', m.meeting_link,
        'meeting_status', m.meeting_status,
        'club_name', c.name
      )
      FROM public.app_club_meeting m
      JOIN public.clubs c ON c.id = m.club_id
      WHERE m.id = p_meeting_id
      LIMIT 1
    ),
    'keynote_assignment', (
      SELECT jsonb_build_object(
        'id', rm.id,
        'role_name', rm.role_name,
        'assigned_user_id', rm.assigned_user_id,
        'booking_status', rm.booking_status,
        'role_status', rm.role_status,
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
        AND rm.role_status = 'Available'
        AND rm.booking_status = 'booked'
        AND lower(rm.role_name) LIKE '%keynote%'
      ORDER BY rm.role_name
      LIMIT 1
    ),
    'keynote_content', (
      SELECT jsonb_build_object(
        'speech_title', k.speech_title,
        'notes', k.notes
      )
      FROM public.app_meeting_keynote_speaker k
      WHERE k.meeting_id = p_meeting_id
        AND v_assigned IS NOT NULL
        AND k.speaker_user_id = v_assigned
      ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC NULLS LAST
      LIMIT 1
    ),
    'is_vpe_for_club', COALESCE(
      (
        SELECT cp.vpe_id = auth.uid()
        FROM public.club_profiles cp
        WHERE cp.club_id = v_club_id
        LIMIT 1
      ),
      false
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_keynote_speaker_corner_snapshot(uuid) IS
  'Authenticated club members: Keynote Speaker Corner (slim meeting, booked keynote row, content, VPE) in one JSON payload.';

GRANT EXECUTE ON FUNCTION public.get_keynote_speaker_corner_snapshot(uuid) TO authenticated;
