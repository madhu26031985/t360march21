-- Table Topic Corner: SELECT / UPDATE / INSERT for TTM row owner OR club VPE.
--
-- Why: Client requests like `table_topic_master_questions?select=*` return 403 when the
-- signed-in user is the club VPE but rows are keyed by `table_topic_master_id` = booked TTM.
-- DELETE was fixed separately; without SELECT, loads and INSERT ... RETURNING still fail.
-- UPDATE is needed for auto-save edits in the same situations.

DROP POLICY IF EXISTS "table_topic_master_questions_select_ttm_or_vpe" ON public.table_topic_master_questions;

CREATE POLICY "table_topic_master_questions_select_ttm_or_vpe"
  ON public.table_topic_master_questions
  FOR SELECT
  TO authenticated
  USING (
    table_topic_master_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp
        ON cp.club_id = m.club_id
       AND cp.vpe_id = (select auth.uid())
      WHERE m.id = table_topic_master_questions.meeting_id
    )
  );

DROP POLICY IF EXISTS "table_topic_master_questions_update_ttm_or_vpe" ON public.table_topic_master_questions;

CREATE POLICY "table_topic_master_questions_update_ttm_or_vpe"
  ON public.table_topic_master_questions
  FOR UPDATE
  TO authenticated
  USING (
    table_topic_master_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp
        ON cp.club_id = m.club_id
       AND cp.vpe_id = (select auth.uid())
      WHERE m.id = table_topic_master_questions.meeting_id
    )
  )
  WITH CHECK (
    table_topic_master_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp
        ON cp.club_id = m.club_id
       AND cp.vpe_id = (select auth.uid())
      WHERE m.id = table_topic_master_questions.meeting_id
    )
  );

DROP POLICY IF EXISTS "table_topic_master_questions_insert_ttm_or_vpe" ON public.table_topic_master_questions;

CREATE POLICY "table_topic_master_questions_insert_ttm_or_vpe"
  ON public.table_topic_master_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    table_topic_master_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp
        ON cp.club_id = m.club_id
       AND cp.vpe_id = (select auth.uid())
      WHERE m.id = table_topic_master_questions.meeting_id
    )
  );

COMMENT ON POLICY "table_topic_master_questions_select_ttm_or_vpe" ON public.table_topic_master_questions IS
  'TTM (row owner) or club VPE may read question bank rows (loads + INSERT/PATCH RETURNING).';

COMMENT ON POLICY "table_topic_master_questions_update_ttm_or_vpe" ON public.table_topic_master_questions IS
  'TTM or club VPE may update bank rows (auto-save).';

COMMENT ON POLICY "table_topic_master_questions_insert_ttm_or_vpe" ON public.table_topic_master_questions IS
  'TTM or club VPE may insert bank rows; `table_topic_master_id` is usually the booked TTM.';
