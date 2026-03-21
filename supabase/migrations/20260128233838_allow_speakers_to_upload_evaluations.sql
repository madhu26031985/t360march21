/*
  # Allow Speakers to Upload Evaluation PDFs

  ## Overview
  Updates the RLS policies for `app_prepared_speech_evaluations` to allow speakers
  to upload and update evaluation PDFs, not just evaluators.

  ## Problem
  Currently only evaluators can upload PDFs. However, speakers often receive 
  completed evaluation forms from evaluators and should be able to upload them.

  ## Solution
  Update the UPDATE policy to allow both evaluators AND speakers to update
  evaluation records (upload PDFs and add comments).

  ## Changes
  - Modify "Evaluators can update assigned evaluations" policy to also allow speakers
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Evaluators can update assigned evaluations" ON app_prepared_speech_evaluations;

-- Create new policy allowing both evaluators and speakers to update
CREATE POLICY "Evaluators and speakers can update evaluations"
  ON app_prepared_speech_evaluations
  FOR UPDATE
  TO authenticated
  USING (evaluator_id = auth.uid() OR speaker_id = auth.uid())
  WITH CHECK (evaluator_id = auth.uid() OR speaker_id = auth.uid());
