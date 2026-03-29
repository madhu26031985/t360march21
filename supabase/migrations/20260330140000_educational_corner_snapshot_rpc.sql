/*
  Educational Corner: one round-trip for meeting + club name + educational role + content + permission flags.

  Replaces multiple PostgREST calls and avoids loading the full club member list on every visit
  (that embed on app_club_user_relationship was the dominant cost on slow networks).
*/

CREATE OR REPLACE FUNCTION public.get_educational_corner_snapshot(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_role jsonb;
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

  SELECT jsonb_build_object(
    'id', rm.id,
    'role_name', rm.role_name,
    'assigned_user_id', rm.assigned_user_id,
    'booking_status', rm.booking_status,
    'role_status', rm.role_status,
    'role_classification', rm.role_classification,
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
  INTO v_role
  FROM public.app_meeting_roles_management rm
  LEFT JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
  WHERE rm.meeting_id = p_meeting_id
    AND rm.role_name = 'Educational Speaker'
    AND rm.role_status = 'Available'
    AND rm.booking_status = 'booked'
  LIMIT 1;

  v_assigned := NULL;
  IF v_role IS NOT NULL THEN
    v_assigned := (v_role->>'assigned_user_id')::uuid;
  END IF;

  RETURN jsonb_build_object(
    'meeting_id', p_meeting_id,
    'club_id', v_club_id,
    'club_name', (SELECT c.name FROM public.clubs c WHERE c.id = v_club_id LIMIT 1),
    'meeting', (SELECT to_jsonb(mt) FROM public.app_club_meeting mt WHERE mt.id = p_meeting_id),
    'educational_role', v_role,
    'educational_content',
    CASE
      WHEN v_assigned IS NOT NULL THEN (
        SELECT jsonb_build_object(
          'speech_title', es.speech_title,
          'notes', es.notes
        )
        FROM public.app_meeting_educational_speaker es
        WHERE es.meeting_id = p_meeting_id
          AND es.speaker_user_id = v_assigned
        LIMIT 1
      )
      ELSE NULL
    END,
    'is_excomm', COALESCE(
      (
        SELECT r.role = 'excomm'
        FROM public.app_club_user_relationship r
        WHERE r.club_id = v_club_id
          AND r.user_id = auth.uid()
          AND r.is_authenticated = true
        LIMIT 1
      ),
      false
    ),
    'is_vpe_club', COALESCE(
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

COMMENT ON FUNCTION public.get_educational_corner_snapshot(uuid) IS
  'Authenticated club members: meeting + Educational Speaker role + educational title/notes + excomm/VPE flags in one JSON payload.';

GRANT EXECUTE ON FUNCTION public.get_educational_corner_snapshot(uuid) TO authenticated;

-- Planner-friendly filter for Educational Speaker booked rows (matches snapshot + legacy queries)
CREATE INDEX IF NOT EXISTS idx_mrm_meeting_educational_speaker_booked
  ON public.app_meeting_roles_management (meeting_id)
  WHERE role_status = 'Available'
    AND booking_status = 'booked'
    AND role_name = 'Educational Speaker';

ANALYZE public.app_meeting_roles_management;
