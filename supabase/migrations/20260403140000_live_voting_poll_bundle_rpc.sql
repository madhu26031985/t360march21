-- Live voting: one RPC replaces N+1 PostgREST calls (poll_items + per-option profile lookups + duplicate simple_poll_votes checks).

CREATE OR REPLACE FUNCTION public.get_live_voting_poll_bundle(p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  SELECT p.club_id INTO v_club_id
  FROM public.polls p
  WHERE p.id = p_poll_id;

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
    'poll_items',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'poll_id', pi.poll_id,
            'question_id', pi.question_id,
            'option_id', pi.option_id,
            'question_text', pi.question_text,
            'option_text', pi.option_text,
            'question_order', pi.question_order,
            'option_order', pi.option_order,
            'vote_count', pi.vote_count,
            'is_active', pi.is_active,
            'created_at', pi.created_at,
            'updated_at', pi.updated_at,
            'avatar_url', public._timer_report_public_avatar(av.avatar_url)
          )
          ORDER BY pi.question_order NULLS LAST, pi.option_order
        )
        FROM public.poll_items pi
        LEFT JOIN LATERAL (
          SELECT p.avatar_url
          FROM public.app_user_profiles p
          INNER JOIN public.app_club_user_relationship r
            ON r.user_id = p.id
            AND r.club_id = v_club_id
            AND r.is_authenticated = true
          WHERE lower(trim(p.full_name)) = lower(trim(pi.option_text))
          LIMIT 1
        ) av ON true
        WHERE pi.poll_id = p_poll_id
          AND pi.is_active = true
      ),
      '[]'::jsonb
    ),
    'user_votes',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'poll_id', v.poll_id,
            'question_id', v.question_id,
            'option_id', v.option_id
          )
        )
        FROM public.simple_poll_votes v
        WHERE v.poll_id = p_poll_id
          AND v.user_id = auth.uid()
      ),
      '[]'::jsonb
    ),
    'has_voted',
    EXISTS (
      SELECT 1
      FROM public.simple_poll_votes v2
      WHERE v2.poll_id = p_poll_id
        AND v2.user_id = auth.uid()
      LIMIT 1
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_live_voting_poll_bundle(uuid) IS
  'Club members: poll_items with avatar_url + current user simple_poll_votes in one JSON response.';

GRANT EXECUTE ON FUNCTION public.get_live_voting_poll_bundle(uuid) TO authenticated;

ALTER FUNCTION public.get_live_voting_poll_bundle(uuid) SET row_security = off;
