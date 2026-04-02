-- Grammarian Word Prep: single lightweight snapshot for fast initial load.

CREATE OR REPLACE FUNCTION public.get_grammarian_word_prep_snapshot(p_meeting_id uuid)
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
    'assigned_grammarian_user_id', (
      SELECT rm.assigned_user_id
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = p_meeting_id
        AND rm.role_name ILIKE '%grammarian%'
        AND rm.booking_status = 'booked'
      LIMIT 1
    ),
    'is_vpe_for_club', COALESCE((
      SELECT (cp.vpe_id = auth.uid())
      FROM public.club_profiles cp
      WHERE cp.club_id = v_club_id
      LIMIT 1
    ), false),
    'word_of_the_day', (
      SELECT jsonb_build_object(
        'id', w.id,
        'word', w.word,
        'part_of_speech', w.part_of_speech,
        'meaning', w.meaning,
        'usage', w.usage,
        'is_published', w.is_published,
        'updated_at', w.updated_at
      )
      FROM public.grammarian_word_of_the_day w
      WHERE w.meeting_id = p_meeting_id
        AND w.grammarian_user_id = COALESCE((
          SELECT rm.assigned_user_id
          FROM public.app_meeting_roles_management rm
          WHERE rm.meeting_id = p_meeting_id
            AND rm.role_name ILIKE '%grammarian%'
            AND rm.booking_status = 'booked'
          LIMIT 1
        ), auth.uid())
      LIMIT 1
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_grammarian_word_prep_snapshot(uuid) IS
  'Word Prep optimized snapshot: assigned grammarian, vpe flag, and word-of-the-day content.';

GRANT EXECUTE ON FUNCTION public.get_grammarian_word_prep_snapshot(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_roles_grammarian_meeting_booked
  ON public.app_meeting_roles_management (meeting_id, booking_status, role_name);

CREATE INDEX IF NOT EXISTS idx_grammarian_word_meeting_user
  ON public.grammarian_word_of_the_day (meeting_id, grammarian_user_id);

