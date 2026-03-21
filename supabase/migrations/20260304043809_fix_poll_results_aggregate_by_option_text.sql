/*
  # Fix Poll Results Aggregation by Option Text

  ## Problem
  When multiple poll_items have the same (question_id, option_text) — e.g. "Shanti Ramakrishnan"
  appearing as both opt1 and opt3 — the populate function processes them one by one.
  The upsert ON CONFLICT (poll_id, question_text, option_text) means the last one processed
  overwrites the first, so if opt3 has 0 votes it wipes out opt1's 4 votes.

  ## Fix
  Rewrite populate_poll_results_repository to aggregate votes grouped by
  (poll_id, question_id, question_text, question_order, option_text, option_order)
  so duplicate option names are summed together correctly.

  Also deactivate the duplicate opt3 for "Shanti Ramakrishnan" in Best Role Player.
*/

-- Deactivate the duplicate poll_item opt3 for Best Role Player
-- (opt1 has all the votes, opt3 is a duplicate with 0 votes)
UPDATE poll_items
SET is_active = false
WHERE poll_id = '4419db9f-0881-475f-a9d5-a9441940248d'
AND option_id = '349981e0-f849-4aad-bd2e-1b2b732434ff_opt3';

-- Replace populate function to aggregate votes by option_text (handles duplicates correctly)
CREATE OR REPLACE FUNCTION populate_poll_results_repository(
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
    FROM polls p
    WHERE (target_poll_id IS NULL OR p.id = target_poll_id)
    AND p.status IN ('published', 'completed')
    ORDER BY p.created_at
  LOOP
    processed_polls := processed_polls + 1;

    -- Total unique voters for this poll
    SELECT COALESCE(COUNT(DISTINCT user_id), 0) INTO total_votes
    FROM simple_poll_votes spv
    WHERE spv.poll_id = poll_record.id;

    -- Aggregate by (question_text, option_text) to handle duplicate option entries
    FOR item_record IN
      SELECT
        pi.poll_id,
        pi.question_text,
        MIN(pi.question_order) as question_order,
        pi.option_text,
        MIN(pi.option_order) as option_order,
        COALESCE(SUM(vote_counts.cnt), 0) as vote_count
      FROM poll_items pi
      LEFT JOIN (
        SELECT spv.question_id, spv.option_id, COUNT(*) as cnt
        FROM simple_poll_votes spv
        WHERE spv.poll_id = poll_record.id
        GROUP BY spv.question_id, spv.option_id
      ) vote_counts ON vote_counts.question_id = pi.question_id
        AND vote_counts.option_id = pi.option_id
      WHERE pi.poll_id = poll_record.id
      AND pi.is_active = true
      GROUP BY pi.poll_id, pi.question_text, pi.option_text
      ORDER BY MIN(pi.question_order), MIN(pi.option_order)
    LOOP
      INSERT INTO poll_results_repository (
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
        CASE WHEN total_votes > 0
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

  RETURN QUERY SELECT
    upserted_count,
    processed_polls,
    format('Successfully processed %s polls and upserted %s result records',
           processed_polls, upserted_count);
END;
$$;

-- Repopulate all polls with corrected aggregation logic
DELETE FROM poll_results_repository;
SELECT * FROM populate_poll_results_repository(NULL);
