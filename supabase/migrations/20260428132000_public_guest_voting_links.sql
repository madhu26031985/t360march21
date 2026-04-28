/*
  Public anonymous voting links

  Option A:
  - one vote per browser/device session
  - anonymous guest voting via public token link
  - link automatically stops accepting votes once poll is closed
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS public_token text;

UPDATE public.polls
SET public_token = gen_random_uuid()::text
WHERE public_token IS NULL OR btrim(public_token) = '';

ALTER TABLE public.polls
  ALTER COLUMN public_token SET DEFAULT gen_random_uuid()::text;

ALTER TABLE public.polls
  ALTER COLUMN public_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_polls_public_token
  ON public.polls(public_token);

CREATE TABLE IF NOT EXISTS public.public_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  option_id text NOT NULL,
  guest_session_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_poll_votes_poll_question_guest
  ON public.public_poll_votes(poll_id, question_id, guest_session_id);

CREATE INDEX IF NOT EXISTS idx_public_poll_votes_poll
  ON public.public_poll_votes(poll_id);

ALTER TABLE public.public_poll_votes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.public_poll_votes FROM PUBLIC;
REVOKE ALL ON public.public_poll_votes FROM anon;
REVOKE ALL ON public.public_poll_votes FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_public_poll_bundle(
  p_public_token text,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll RECORD;
  v_has_voted boolean := false;
BEGIN
  SELECT p.id, p.title, p.description, p.status, p.is_public
  INTO v_poll
  FROM public.polls p
  WHERE p.public_token = NULLIF(btrim(p_public_token), '')
  LIMIT 1;

  IF v_poll.id IS NULL OR COALESCE(v_poll.is_public, true) = false THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF NULLIF(btrim(COALESCE(p_guest_session_id, '')), '') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.public_poll_votes ppv
      WHERE ppv.poll_id = v_poll.id
        AND ppv.guest_session_id = p_guest_session_id
    )
    INTO v_has_voted;
  END IF;

  RETURN jsonb_build_object(
    'poll',
    jsonb_build_object(
      'id', v_poll.id,
      'title', v_poll.title,
      'description', v_poll.description,
      'status', v_poll.status,
      'is_public', v_poll.is_public
    ),
    'is_open', v_poll.status = 'published',
    'has_voted', v_has_voted,
    'poll_items',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'poll_id', pi.poll_id,
            'question_id', pi.question_id,
            'option_id', pi.option_id,
            'option_text', pi.option_text,
            'question_text', pi.question_text,
            'question_order', pi.question_order,
            'option_order', pi.option_order
          )
          ORDER BY pi.question_order, pi.option_order
        )
        FROM public.poll_items pi
        WHERE pi.poll_id = v_poll.id
          AND pi.is_active = true
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_poll_bundle(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_poll_bundle(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_poll_votes(
  p_public_token text,
  p_guest_session_id text,
  p_votes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll RECORD;
  v_required_questions integer := 0;
  v_valid_votes integer := 0;
BEGIN
  IF NULLIF(btrim(COALESCE(p_guest_session_id, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_session');
  END IF;

  SELECT p.id, p.status, p.is_public
  INTO v_poll
  FROM public.polls p
  WHERE p.public_token = NULLIF(btrim(p_public_token), '')
  LIMIT 1;

  IF v_poll.id IS NULL OR COALESCE(v_poll.is_public, true) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_poll.status <> 'published' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'closed');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.public_poll_votes ppv
    WHERE ppv.poll_id = v_poll.id
      AND ppv.guest_session_id = p_guest_session_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_voted');
  END IF;

  IF jsonb_typeof(COALESCE(p_votes, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  SELECT COUNT(DISTINCT pi.question_id::text)
  INTO v_required_questions
  FROM public.poll_items pi
  WHERE pi.poll_id = v_poll.id
    AND pi.is_active = true;

  IF v_required_questions = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_questions');
  END IF;

  WITH submitted AS (
    SELECT DISTINCT
      btrim(x.question_id) AS question_id,
      btrim(x.option_id) AS option_id
    FROM jsonb_to_recordset(COALESCE(p_votes, '[]'::jsonb)) AS x(question_id text, option_id text)
    WHERE NULLIF(btrim(x.question_id), '') IS NOT NULL
      AND NULLIF(btrim(x.option_id), '') IS NOT NULL
  ),
  valid AS (
    SELECT s.question_id, s.option_id
    FROM submitted s
    JOIN public.poll_items pi
      ON pi.poll_id = v_poll.id
     AND pi.is_active = true
     AND pi.question_id::text = s.question_id
     AND pi.option_id = s.option_id
  )
  SELECT COUNT(*) INTO v_valid_votes
  FROM valid;

  IF v_valid_votes <> v_required_questions THEN
    RETURN jsonb_build_object('ok', false, 'error', 'incomplete');
  END IF;

  INSERT INTO public.public_poll_votes (poll_id, question_id, option_id, guest_session_id)
  SELECT
    v_poll.id,
    v.question_id,
    v.option_id,
    p_guest_session_id
  FROM (
    WITH submitted AS (
      SELECT DISTINCT
        btrim(x.question_id) AS question_id,
        btrim(x.option_id) AS option_id
      FROM jsonb_to_recordset(COALESCE(p_votes, '[]'::jsonb)) AS x(question_id text, option_id text)
      WHERE NULLIF(btrim(x.question_id), '') IS NOT NULL
        AND NULLIF(btrim(x.option_id), '') IS NOT NULL
    )
    SELECT s.question_id, s.option_id
    FROM submitted s
    JOIN public.poll_items pi
      ON pi.poll_id = v_poll.id
     AND pi.is_active = true
     AND pi.question_id::text = s.question_id
     AND pi.option_id = s.option_id
  ) v;

  PERFORM public.populate_poll_results_repository(v_poll.id);

  RETURN jsonb_build_object('ok', true, 'poll_id', v_poll.id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_voted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_poll_votes(text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_poll_votes(text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.populate_poll_results_repository(
  target_poll_id uuid DEFAULT NULL
)
RETURNS TABLE(records_inserted integer, polls_processed integer, execution_summary text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  poll_record RECORD;
  item_record RECORD;
  total_votes integer;
  upserted_count integer := 0;
  processed_polls integer := 0;
BEGIN
  FOR poll_record IN
    SELECT p.id, p.title, p.created_at
    FROM public.polls p
    WHERE (target_poll_id IS NULL OR p.id = target_poll_id)
      AND p.status IN ('published', 'completed')
    ORDER BY p.created_at
  LOOP
    processed_polls := processed_polls + 1;

    SELECT COUNT(*)
    INTO total_votes
    FROM (
      SELECT DISTINCT 'member:' || spv.user_id::text AS voter_key
      FROM public.simple_poll_votes spv
      WHERE spv.poll_id = poll_record.id

      UNION

      SELECT DISTINCT 'guest:' || ppv.guest_session_id AS voter_key
      FROM public.public_poll_votes ppv
      WHERE ppv.poll_id = poll_record.id
    ) voters;

    FOR item_record IN
      SELECT
        pi.poll_id,
        pi.question_text,
        MIN(pi.question_order) AS question_order,
        pi.option_text,
        MIN(pi.option_order) AS option_order,
        COALESCE(SUM(vote_counts.cnt), 0) AS vote_count
      FROM public.poll_items pi
      LEFT JOIN (
        SELECT all_votes.question_id, all_votes.option_id, COUNT(*) AS cnt
        FROM (
          SELECT spv.question_id::text AS question_id, spv.option_id
          FROM public.simple_poll_votes spv
          WHERE spv.poll_id = poll_record.id

          UNION ALL

          SELECT ppv.question_id, ppv.option_id
          FROM public.public_poll_votes ppv
          WHERE ppv.poll_id = poll_record.id
        ) all_votes
        GROUP BY all_votes.question_id, all_votes.option_id
      ) vote_counts
        ON vote_counts.question_id = pi.question_id::text
       AND vote_counts.option_id = pi.option_id
      WHERE pi.poll_id = poll_record.id
        AND pi.is_active = true
      GROUP BY pi.poll_id, pi.question_text, pi.option_text
      ORDER BY MIN(pi.question_order), MIN(pi.option_order)
    LOOP
      INSERT INTO public.poll_results_repository (
        poll_id,
        question_text,
        option_text,
        votes,
        percentage,
        question_order,
        option_order
      ) VALUES (
        item_record.poll_id,
        item_record.question_text,
        item_record.option_text,
        item_record.vote_count,
        CASE
          WHEN total_votes > 0
            THEN ROUND((item_record.vote_count::decimal / total_votes::decimal) * 100, 2)
          ELSE 0.00
        END,
        item_record.question_order,
        item_record.option_order
      )
      ON CONFLICT (poll_id, question_text, option_text)
      DO UPDATE SET
        votes = EXCLUDED.votes,
        percentage = EXCLUDED.percentage,
        question_order = EXCLUDED.question_order,
        option_order = EXCLUDED.option_order,
        updated_at = now();

      upserted_count := upserted_count + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY
  SELECT
    upserted_count,
    processed_polls,
    format(
      'Successfully processed %s polls and upserted %s result records',
      processed_polls,
      upserted_count
    );
END;
$$;

