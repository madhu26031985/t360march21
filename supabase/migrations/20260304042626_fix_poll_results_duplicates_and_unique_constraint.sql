/*
  # Fix Poll Results Duplicates and Add Unique Constraint

  ## Problem
  The poll_results_repository table has massive duplicate rows because:
  1. No unique constraint on (poll_id, question_text, option_text) so
     ON CONFLICT DO NOTHING never actually prevented anything
  2. Triggers fire populate_poll_results_repository independently AFTER
     refresh_poll_results already deleted+reinserted, causing cascading dupes

  ## Fix
  1. Clean up all existing duplicate rows
  2. Add a unique constraint on (poll_id, question_text, option_text)
  3. Update populate_poll_results_repository to use proper upsert
  4. Repopulate all polls with correct counts
*/

-- Step 1: Delete all existing duplicate/corrupt data
DELETE FROM poll_results_repository;

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE poll_results_repository
  ADD CONSTRAINT uq_poll_results_poll_question_option
  UNIQUE (poll_id, question_text, option_text);

-- Step 3: Replace the function with correct upsert logic (same return signature)
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
  vote_count integer;
  total_votes integer;
  vote_percentage decimal(5,2);
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

    FOR item_record IN
      SELECT DISTINCT
        pi.poll_id,
        pi.question_id,
        pi.question_text,
        pi.question_order,
        pi.option_id,
        pi.option_text,
        pi.option_order
      FROM poll_items pi
      WHERE pi.poll_id = poll_record.id
      AND pi.is_active = true
      ORDER BY pi.question_order, pi.option_order
    LOOP
      SELECT COALESCE(COUNT(*), 0) INTO vote_count
      FROM simple_poll_votes spv
      WHERE spv.poll_id = item_record.poll_id
      AND spv.question_id = item_record.question_id
      AND spv.option_id = item_record.option_id;

      IF total_votes > 0 THEN
        vote_percentage := ROUND((vote_count::decimal / total_votes::decimal) * 100, 2);
      ELSE
        vote_percentage := 0.00;
      END IF;

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
        vote_count,
        vote_percentage,
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

-- Step 4: Repopulate all polls with correct data
SELECT * FROM populate_poll_results_repository(NULL);
