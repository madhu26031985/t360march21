-- Table Topic Corner: allow DELETE on question bank rows for the assigned Table Topic Master
-- and for the club VPE. Without a DELETE policy, Clear fails with 403 and the next bank
-- reload re-hydrates the slot from the server.

DROP POLICY IF EXISTS "table_topic_master_questions_delete_ttm_or_vpe" ON public.table_topic_master_questions;

CREATE POLICY "table_topic_master_questions_delete_ttm_or_vpe"
  ON public.table_topic_master_questions
  FOR DELETE
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

COMMENT ON POLICY "table_topic_master_questions_delete_ttm_or_vpe" ON public.table_topic_master_questions IS
  'TTM (row owner) or club VPE for the meeting may delete bank questions (e.g. Clear in Table Topic Corner).';
