/*
  # Add UPDATE policies for grammarian live observation tables

  ## Problem
  The grammarian_live_good_usage and grammarian_live_improvements tables
  had no UPDATE RLS policy. This silently blocked the publish/unpublish
  operation (updating is_published) without returning an error.

  ## Changes
  - Add UPDATE policy on grammarian_live_good_usage for the grammarian
  - Add UPDATE policy on grammarian_live_improvements for the grammarian
*/

CREATE POLICY "Grammarian can update own live good usage observations"
  ON grammarian_live_good_usage
  FOR UPDATE
  TO authenticated
  USING (grammarian_id = auth.uid())
  WITH CHECK (grammarian_id = auth.uid());

CREATE POLICY "Grammarian can update own live improvement observations"
  ON grammarian_live_improvements
  FOR UPDATE
  TO authenticated
  USING (grammarian_id = auth.uid())
  WITH CHECK (grammarian_id = auth.uid());
