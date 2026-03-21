/*
  # Update Evaluation Creation to Support Ice Breaker Speeches

  ## Summary
  Updates the evaluation creation triggers to:
  1. Create evaluations for both Prepared Speaker and Ice Breaker roles
  2. Populate speech_category and speaker_role_name fields
  3. Include both Prepared Speech 1-5 and Ice Breaker Speech 1-5

  ## Changes
  - Update create_prepared_speech_evaluation() function
  - Update sync_prepared_speech_evaluation_data() function
  - Backfill existing records with speech_category and speaker_role_name

  ## Notes
  - Ice Breaker Speech roles: "Ice Breaker Speech 1" to "Ice Breaker Speech 5"
  - Prepared Speaker roles: "Prepared Speaker 1" to "Prepared Speaker 5"
  - Evaluations created when any evaluator is assigned
*/

-- Step 1: Update function to create evaluations for both Prepared and Ice Breaker speeches
CREATE OR REPLACE FUNCTION create_prepared_speech_evaluation()
RETURNS TRIGGER AS $$
DECLARE
  v_speech_category TEXT;
BEGIN
  -- Only create evaluation if:
  -- 1. Evaluator is assigned (not null)
  -- 2. Role is a prepared speaker or ice breaker role
  -- 3. Evaluation doesn't already exist
  IF NEW.assigned_evaluator_id IS NOT NULL 
     AND (NEW.role_name ILIKE '%prepared%speaker%' OR NEW.role_name ILIKE '%ice%breaker%speech%')
     AND NOT EXISTS (
       SELECT 1 FROM app_prepared_speech_evaluations 
       WHERE evaluation_pathway_id = NEW.id
     ) THEN
    
    -- Determine speech category
    IF NEW.role_name ILIKE '%ice%breaker%speech%' THEN
      v_speech_category := 'Ice Breaker';
    ELSE
      v_speech_category := 'Prepared Speech';
    END IF;
    
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
      speech_category,
      speaker_role_name,
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
      v_speech_category,
      NEW.role_name,
      'pending',
      now(),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update sync function to include speech_category and speaker_role_name
CREATE OR REPLACE FUNCTION sync_prepared_speech_evaluation_data()
RETURNS TRIGGER AS $$
DECLARE
  v_speech_category TEXT;
BEGIN
  -- Determine speech category
  IF NEW.role_name ILIKE '%ice%breaker%speech%' THEN
    v_speech_category := 'Ice Breaker';
  ELSIF NEW.role_name ILIKE '%prepared%speaker%' THEN
    v_speech_category := 'Prepared Speech';
  END IF;

  -- Update evaluation record when pathway data changes
  UPDATE app_prepared_speech_evaluations
  SET
    speech_title = NEW.speech_title,
    pathway_name = NEW.pathway_name,
    project_name = NEW.project_name,
    project_number = NEW.project_number,
    level = NEW.level,
    evaluator_id = NEW.assigned_evaluator_id,
    speech_category = v_speech_category,
    speaker_role_name = NEW.role_name,
    updated_at = now()
  WHERE evaluation_pathway_id = NEW.id
    AND NEW.assigned_evaluator_id IS NOT NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Backfill speech_category and speaker_role_name for existing records
UPDATE app_prepared_speech_evaluations pse
SET 
  speech_category = CASE 
    WHEN ep.role_name ILIKE '%ice%breaker%speech%' THEN 'Ice Breaker'
    ELSE 'Prepared Speech'
  END,
  speaker_role_name = ep.role_name,
  updated_at = now()
FROM app_evaluation_pathway ep
WHERE pse.evaluation_pathway_id = ep.id
  AND pse.speech_category IS NULL;

-- Step 4: Backfill evaluations for existing Ice Breaker speeches that weren't captured before
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
  speech_category,
  speaker_role_name,
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
  'Ice Breaker',
  ep.role_name,
  CASE 
    WHEN ep.completed_evaluation_form IS NOT NULL THEN 'uploaded'
    ELSE 'pending'
  END,
  ep.created_at,
  now()
FROM app_evaluation_pathway ep
WHERE ep.assigned_evaluator_id IS NOT NULL
  AND ep.role_name ILIKE '%ice%breaker%speech%'
  AND NOT EXISTS (
    SELECT 1 FROM app_prepared_speech_evaluations pse
    WHERE pse.evaluation_pathway_id = ep.id
  );

-- Add comment
COMMENT ON FUNCTION create_prepared_speech_evaluation() IS 
  'Creates evaluation records for both Prepared Speech and Ice Breaker speeches when evaluator is assigned';
