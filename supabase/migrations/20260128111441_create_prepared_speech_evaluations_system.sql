/*
  # Create Prepared Speech Evaluations System

  ## Overview
  Creates a comprehensive system for managing prepared speech evaluations, tracking the complete lifecycle from evaluator assignment to PDF upload.

  ## 1. New Tables
    - `app_prepared_speech_evaluations`
      - `id` (uuid, primary key) - Unique evaluation record ID
      - `evaluation_pathway_id` (uuid, foreign key) - Links to app_evaluation_pathway
      - `meeting_id` (uuid, foreign key) - Meeting reference
      - `club_id` (uuid, foreign key) - Club reference
      - `speaker_id` (uuid, foreign key) - Speaker user ID
      - `evaluator_id` (uuid, foreign key) - Evaluator user ID
      - `speech_title` (text) - Speech title
      - `pathway_name` (text) - Pathway name
      - `project_name` (text) - Project name
      - `project_number` (text) - Project number (1-20)
      - `level` (integer) - Level number
      - `evaluation_pdf_url` (text) - URL of uploaded evaluation PDF
      - `evaluation_status` (text) - Status: pending, uploaded, completed
      - `uploaded_at` (timestamptz) - When PDF was uploaded
      - `uploaded_by` (uuid) - Who uploaded the PDF
      - `evaluator_comments` (text) - Comments from evaluator
      - `created_at` (timestamptz) - Record creation time
      - `updated_at` (timestamptz) - Last update time

  ## 2. Security
    - Enable RLS on all tables
    - Speakers can view their own evaluations
    - Evaluators can view and update evaluations assigned to them
    - Club executives can view all evaluations for their club

  ## 3. Triggers
    - Auto-create evaluation record when evaluator is assigned in app_evaluation_pathway
    - Auto-update evaluation record when pathway data changes

  ## Important Notes
  - Uses TEXT for project_number to match existing constraint
  - Evaluation status tracks: 'pending' -> 'uploaded' -> 'completed'
  - PDF uploads stored in evaluation-forms bucket
*/

-- Create the prepared speech evaluations table
CREATE TABLE IF NOT EXISTS app_prepared_speech_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_pathway_id uuid NOT NULL REFERENCES app_evaluation_pathway(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  speaker_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  speech_title text,
  pathway_name text,
  project_name text,
  project_number text,
  level integer,
  evaluation_pdf_url text,
  evaluation_status text NOT NULL DEFAULT 'pending' CHECK (evaluation_status IN ('pending', 'uploaded', 'completed')),
  uploaded_at timestamptz,
  uploaded_by uuid REFERENCES app_user_profiles(id),
  evaluator_comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_prepared_speech_eval_evaluator ON app_prepared_speech_evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_prepared_speech_eval_speaker ON app_prepared_speech_evaluations(speaker_id);
CREATE INDEX IF NOT EXISTS idx_prepared_speech_eval_meeting ON app_prepared_speech_evaluations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_prepared_speech_eval_club ON app_prepared_speech_evaluations(club_id);
CREATE INDEX IF NOT EXISTS idx_prepared_speech_eval_status ON app_prepared_speech_evaluations(evaluation_status);

-- Enable RLS
ALTER TABLE app_prepared_speech_evaluations ENABLE ROW LEVEL SECURITY;

-- Policy: Speakers can view their own evaluations
CREATE POLICY "Speakers can view own evaluations"
  ON app_prepared_speech_evaluations
  FOR SELECT
  TO authenticated
  USING (speaker_id = auth.uid());

-- Policy: Evaluators can view evaluations assigned to them
CREATE POLICY "Evaluators can view assigned evaluations"
  ON app_prepared_speech_evaluations
  FOR SELECT
  TO authenticated
  USING (evaluator_id = auth.uid());

-- Policy: Evaluators can update their evaluations (upload PDF, add comments)
CREATE POLICY "Evaluators can update assigned evaluations"
  ON app_prepared_speech_evaluations
  FOR UPDATE
  TO authenticated
  USING (evaluator_id = auth.uid())
  WITH CHECK (evaluator_id = auth.uid());

-- Policy: Club executives can view all evaluations in their club
CREATE POLICY "Club executives can view club evaluations"
  ON app_prepared_speech_evaluations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = app_prepared_speech_evaluations.club_id
        AND app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.role IN ('president', 'vpe', 'vpm', 'secretary')
    )
  );

-- Policy: Club executives can insert evaluation records
CREATE POLICY "Club executives can create evaluations"
  ON app_prepared_speech_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = app_prepared_speech_evaluations.club_id
        AND app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.role IN ('president', 'vpe', 'vpm', 'secretary')
    )
  );

-- Function: Auto-create evaluation record when evaluator is assigned
CREATE OR REPLACE FUNCTION create_prepared_speech_evaluation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create evaluation if:
  -- 1. Evaluator is being assigned (not null)
  -- 2. Role is a prepared speaker role
  -- 3. Evaluation doesn't already exist
  IF NEW.assigned_evaluator_id IS NOT NULL 
     AND NEW.role_name ILIKE '%prepared%speaker%'
     AND NOT EXISTS (
       SELECT 1 FROM app_prepared_speech_evaluations 
       WHERE evaluation_pathway_id = NEW.id
     ) THEN
    
    INSERT INTO app_prepared_speech_evaluations (
      evaluation_pathway_id,
      meeting_id,
      club_id,
      speaker_id,
      evaluator_id,
      speech_title,
      pathway_name,
      project_name,
      project_number,
      level,
      evaluation_status,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.meeting_id,
      NEW.club_id,
      NEW.user_id,
      NEW.assigned_evaluator_id,
      NEW.speech_title,
      NEW.pathway_name,
      NEW.project_name,
      NEW.project_number,
      NEW.level,
      'pending',
      now(),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Create evaluation when evaluator assigned
DROP TRIGGER IF EXISTS trigger_create_prepared_speech_evaluation ON app_evaluation_pathway;
CREATE TRIGGER trigger_create_prepared_speech_evaluation
  AFTER INSERT OR UPDATE OF assigned_evaluator_id
  ON app_evaluation_pathway
  FOR EACH ROW
  EXECUTE FUNCTION create_prepared_speech_evaluation();

-- Function: Sync evaluation data when pathway data changes
CREATE OR REPLACE FUNCTION sync_prepared_speech_evaluation_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Update evaluation record when pathway data changes
  UPDATE app_prepared_speech_evaluations
  SET
    speech_title = NEW.speech_title,
    pathway_name = NEW.pathway_name,
    project_name = NEW.project_name,
    project_number = NEW.project_number,
    level = NEW.level,
    evaluator_id = NEW.assigned_evaluator_id,
    updated_at = now()
  WHERE evaluation_pathway_id = NEW.id
    AND NEW.assigned_evaluator_id IS NOT NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Sync evaluation data when pathway updated
DROP TRIGGER IF EXISTS trigger_sync_prepared_speech_evaluation_data ON app_evaluation_pathway;
CREATE TRIGGER trigger_sync_prepared_speech_evaluation_data
  AFTER UPDATE OF speech_title, pathway_name, project_name, project_number, level, assigned_evaluator_id
  ON app_evaluation_pathway
  FOR EACH ROW
  EXECUTE FUNCTION sync_prepared_speech_evaluation_data();

-- Backfill: Create evaluation records for existing pathway entries with assigned evaluators
INSERT INTO app_prepared_speech_evaluations (
  evaluation_pathway_id,
  meeting_id,
  club_id,
  speaker_id,
  evaluator_id,
  speech_title,
  pathway_name,
  project_name,
  project_number,
  level,
  evaluation_status,
  created_at,
  updated_at
)
SELECT
  ep.id,
  ep.meeting_id,
  ep.club_id,
  ep.user_id,
  ep.assigned_evaluator_id,
  ep.speech_title,
  ep.pathway_name,
  ep.project_name,
  ep.project_number,
  ep.level,
  CASE 
    WHEN ep.completed_evaluation_form IS NOT NULL THEN 'uploaded'
    ELSE 'pending'
  END,
  ep.created_at,
  now()
FROM app_evaluation_pathway ep
WHERE ep.assigned_evaluator_id IS NOT NULL
  AND ep.role_name ILIKE '%prepared%speaker%'
  AND NOT EXISTS (
    SELECT 1 FROM app_prepared_speech_evaluations pse
    WHERE pse.evaluation_pathway_id = ep.id
  );

-- Migrate existing completed evaluation forms
UPDATE app_prepared_speech_evaluations pse
SET 
  evaluation_pdf_url = ep.completed_evaluation_form,
  evaluation_status = 'uploaded',
  evaluator_comments = ep.comments_by_evaluator,
  updated_at = now()
FROM app_evaluation_pathway ep
WHERE pse.evaluation_pathway_id = ep.id
  AND ep.completed_evaluation_form IS NOT NULL
  AND pse.evaluation_pdf_url IS NULL;
