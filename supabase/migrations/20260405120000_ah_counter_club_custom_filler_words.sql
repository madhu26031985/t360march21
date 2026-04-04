-- Club-level custom Ah Counter filler words (persisted for all meetings in the club)
-- + JSONB counts on ah_counter_reports for those words

-- ---------------------------------------------------------------------------
-- 1) Vocabulary: one row per club per distinct word (case-insensitive)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ah_counter_club_custom_filler_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  word text NOT NULL,
  created_by uuid REFERENCES public.app_user_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ah_counter_club_filler_word_len CHECK (
    char_length(trim(word)) >= 1 AND char_length(trim(word)) <= 30
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ah_counter_club_custom_filler_words_club_word_iu
  ON public.ah_counter_club_custom_filler_words (club_id, lower(trim(word)));

CREATE INDEX IF NOT EXISTS ah_counter_club_custom_filler_words_club
  ON public.ah_counter_club_custom_filler_words (club_id);

ALTER TABLE public.ah_counter_club_custom_filler_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ah_counter_club_filler_select"
  ON public.ah_counter_club_custom_filler_words
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.app_club_user_relationship r
      WHERE r.club_id = ah_counter_club_custom_filler_words.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "ah_counter_club_filler_insert"
  ON public.ah_counter_club_custom_filler_words
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.app_club_user_relationship r
      WHERE r.club_id = ah_counter_club_custom_filler_words.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "ah_counter_club_filler_delete"
  ON public.ah_counter_club_custom_filler_words
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = ah_counter_club_custom_filler_words.club_id
        AND cp.vpe_id = auth.uid()
    )
  );

COMMENT ON TABLE public.ah_counter_club_custom_filler_words IS
  'User-added filler words for a club; shown in Ah Counter Corner for every meeting.';

-- ---------------------------------------------------------------------------
-- 2) Per-report-row counts for custom fillers (keys = lower(trim(word)))
-- ---------------------------------------------------------------------------
ALTER TABLE public.ah_counter_reports
  ADD COLUMN IF NOT EXISTS custom_filler_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.ah_counter_reports.custom_filler_counts IS
  'Counts for club custom filler words: object keys are lower(trim(word)), values are non-negative integers.';

-- ---------------------------------------------------------------------------
-- 3) Include custom_filler_counts in report rows RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ah_counter_report_rows(p_meeting_id uuid)
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

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ar.id,
        'speaker_user_id', ar.speaker_user_id,
        'speaker_name', ar.speaker_name,
        'ah_count', ar.ah_count,
        'um_count', ar.um_count,
        'uh_count', ar.uh_count,
        'er_count', ar.er_count,
        'hmm_count', ar.hmm_count,
        'like_count', ar.like_count,
        'so_count', ar.so_count,
        'well_count', ar.well_count,
        'okay_count', ar.okay_count,
        'you_know_count', ar.you_know_count,
        'right_count', ar.right_count,
        'actually_count', ar.actually_count,
        'basically_count', ar.basically_count,
        'literally_count', ar.literally_count,
        'i_mean_count', ar.i_mean_count,
        'you_see_count', ar.you_see_count,
        'custom_filler_counts', COALESCE(ar.custom_filler_counts, '{}'::jsonb),
        'app_user_profiles',
          CASE
            WHEN p.id IS NOT NULL THEN jsonb_build_object(
              'avatar_url', public._timer_report_public_avatar(p.avatar_url)
            )
            ELSE NULL
          END
      )
      ORDER BY ar.speaker_name
    )
    FROM public.ah_counter_reports ar
    LEFT JOIN public.app_user_profiles p ON p.id = ar.speaker_user_id
    WHERE ar.meeting_id = p_meeting_id
      AND ar.club_id = v_club_id
  ), '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_ah_counter_report_rows(uuid) IS
  'Authenticated club members: Ah Counter report rows (columns + custom_filler_counts + avatar).';
