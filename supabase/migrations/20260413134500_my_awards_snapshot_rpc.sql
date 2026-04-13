-- My Awards: one RPC round-trip for growth tab.

CREATE INDEX IF NOT EXISTS idx_polls_club_created_at
  ON public.polls (club_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_poll_results_poll_question_votes
  ON public.poll_results_repository (poll_id, question_order, votes DESC);

CREATE OR REPLACE FUNCTION public.get_my_awards_snapshot(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_full_name text := '';
  v_first_name text := '';
BEGIN
  IF v_uid IS NULL OR p_club_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_club_user_relationship r
    WHERE r.club_id = p_club_id
      AND r.user_id = v_uid
      AND r.is_authenticated = true
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT
    COALESCE(TRIM(up.full_name), ''),
    COALESCE(NULLIF(split_part(TRIM(up.full_name), ' ', 1), ''), '')
  INTO v_full_name, v_first_name
  FROM public.app_user_profiles up
  WHERE up.id = v_uid
  LIMIT 1;

  IF v_full_name = '' AND v_first_name = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    WITH club_polls AS (
      SELECT p.id, p.title, p.created_at
      FROM public.polls p
      WHERE p.club_id = p_club_id
      ORDER BY p.created_at DESC
      LIMIT 120
    ),
    ranked AS (
      SELECT
        pr.poll_id,
        pr.question_order,
        pr.question_text,
        pr.option_text,
        COALESCE(pr.votes, 0) AS votes,
        MAX(COALESCE(pr.votes, 0)) OVER (PARTITION BY pr.poll_id, pr.question_order) AS max_votes
      FROM public.poll_results_repository pr
      INNER JOIN club_polls cp ON cp.id = pr.poll_id
    ),
    winners AS (
      SELECT
        r.poll_id,
        r.question_order,
        r.question_text,
        r.option_text
      FROM ranked r
      WHERE r.max_votes > 0
        AND r.votes = r.max_votes
    ),
    mine AS (
      SELECT
        w.poll_id,
        w.question_order,
        w.question_text,
        w.option_text
      FROM winners w
      WHERE
        lower(COALESCE(w.option_text, '')) LIKE '%' || lower(v_full_name) || '%'
        OR lower(v_full_name) LIKE '%' || lower(COALESCE(w.option_text, '')) || '%'
        OR lower(COALESCE(w.option_text, '')) LIKE '%' || lower(v_first_name) || '%'
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'award_name', COALESCE(m.question_text, 'Award'),
        'question_text', m.question_text,
        'poll_title', cp.title,
        'meeting_date', cp.created_at
      )
      ORDER BY cp.created_at DESC
    )
    FROM mine m
    INNER JOIN club_polls cp ON cp.id = m.poll_id
  ), '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_my_awards_snapshot(uuid) IS
  'Authenticated club member: returns awards won from poll winners for My Growth > My Awards.';

GRANT EXECUTE ON FUNCTION public.get_my_awards_snapshot(uuid) TO authenticated;
ALTER FUNCTION public.get_my_awards_snapshot(uuid) SET row_security = off;

ANALYZE public.polls;
ANALYZE public.poll_results_repository;
