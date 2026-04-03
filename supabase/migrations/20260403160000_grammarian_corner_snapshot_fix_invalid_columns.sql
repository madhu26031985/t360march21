-- Fix get_grammarian_corner_snapshot 400s: grammarian_word/idiom/quote tables have no published_at.
-- Safe daily_elements when app_grammarian_daily_elements is absent.
-- When Grammarian is unbooked, effective user is auth.uid() (lexicon + daily rows for current user).
-- Avatars via _timer_report_public_avatar.

CREATE OR REPLACE FUNCTION public.get_grammarian_corner_snapshot(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_assigned_grammarian_id uuid;
  v_effective_grammarian_id uuid;
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

  SELECT rm.assigned_user_id INTO v_assigned_grammarian_id
  FROM public.app_meeting_roles_management rm
  WHERE rm.meeting_id = p_meeting_id
    AND rm.booking_status = 'booked'
    AND rm.assigned_user_id IS NOT NULL
    AND lower(rm.role_name) LIKE '%grammarian%'
  ORDER BY rm.role_name
  LIMIT 1;

  v_effective_grammarian_id := COALESCE(v_assigned_grammarian_id, auth.uid());

  RETURN jsonb_build_object(
    'meeting_id', p_meeting_id,
    'club_id', v_club_id,
    'meeting', (
      SELECT jsonb_build_object(
        'id', mt.id,
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
      LIMIT 1
    ),
    'club_name', (SELECT c.name FROM public.clubs c WHERE c.id = v_club_id LIMIT 1),
    'assigned_grammarian',
    (
      SELECT jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'avatar_url', public._timer_report_public_avatar(p.avatar_url)
      )
      FROM public.app_user_profiles p
      WHERE p.id = v_assigned_grammarian_id
      LIMIT 1
    ),
    'is_vpe_for_club', COALESCE(
      (
        SELECT (cp.vpe_id = auth.uid())
        FROM public.club_profiles cp
        WHERE cp.club_id = v_club_id
        LIMIT 1
      ),
      false
    ),
    'daily_elements',
    CASE
      WHEN to_regclass('public.app_grammarian_daily_elements') IS NULL THEN NULL
      ELSE (
        SELECT jsonb_build_object(
          'word_of_the_day', d.word_of_the_day,
          'idiom_of_the_day', d.idiom_of_the_day,
          'phrase_of_the_day', d.phrase_of_the_day,
          'quote_of_the_day', d.quote_of_the_day
        )
        FROM public.app_grammarian_daily_elements d
        WHERE d.meeting_id = p_meeting_id
          AND d.grammarian_user_id = v_effective_grammarian_id
        ORDER BY d.created_at DESC
        LIMIT 1
      )
    END,
    'word_of_the_day', (
      SELECT jsonb_build_object(
        'id', w.id,
        'word', w.word,
        'part_of_speech', w.part_of_speech,
        'meaning', w.meaning,
        'usage', w.usage,
        'is_published', w.is_published,
        'created_at', w.created_at
      )
      FROM public.grammarian_word_of_the_day w
      WHERE w.meeting_id = p_meeting_id
        AND w.grammarian_user_id = v_effective_grammarian_id
      LIMIT 1
    ),
    'idiom_of_the_day', (
      SELECT jsonb_build_object(
        'id', i.id,
        'idiom', i.idiom,
        'meaning', i.meaning,
        'usage', i.usage,
        'is_published', i.is_published,
        'created_at', i.created_at,
        'grammarian_user_id', i.grammarian_user_id
      )
      FROM public.grammarian_idiom_of_the_day i
      WHERE i.meeting_id = p_meeting_id
        AND i.grammarian_user_id = v_effective_grammarian_id
      LIMIT 1
    ),
    'quote_of_the_day', (
      SELECT jsonb_build_object(
        'id', q.id,
        'quote', q.quote,
        'meaning', q.meaning,
        'usage', q.usage,
        'is_published', q.is_published,
        'created_at', q.created_at,
        'grammarian_user_id', q.grammarian_user_id
      )
      FROM public.grammarian_quote_of_the_day q
      WHERE q.meeting_id = p_meeting_id
        AND q.grammarian_user_id = v_effective_grammarian_id
      LIMIT 1
    ),
    'has_published_live_observations', COALESCE(
      EXISTS (
        SELECT 1
        FROM public.grammarian_live_good_usage g
        WHERE g.meeting_id = p_meeting_id
          AND g.is_published = true
        LIMIT 1
      ) OR EXISTS (
        SELECT 1
        FROM public.grammarian_live_improvements i
        WHERE i.meeting_id = p_meeting_id
          AND i.is_published = true
        LIMIT 1
      ),
      false
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_grammarian_corner_snapshot(uuid) IS
  'Authenticated club members: grammarian corner snapshot (schema-safe columns, unbooked uses auth uid).';
