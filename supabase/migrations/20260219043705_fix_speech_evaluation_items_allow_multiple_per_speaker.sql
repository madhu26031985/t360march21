/*
  # Fix Speech Evaluation Items to Allow Multiple Speeches Per Speaker
  
  1. Problem
    - Current constraint: UNIQUE (agenda_item_id, speaker_id)
    - This prevents a speaker from having multiple speeches in the same session
    - But speakers can deliver both prepared speech AND ice breaker in one meeting
  
  2. Solution
    - Drop the old constraint
    - Add new constraint: UNIQUE (agenda_item_id, evaluation_id)
    - This ensures each evaluation appears only once but allows multiple speeches per speaker
  
  3. Changes
    - Drop old unique constraint
    - Add new unique constraint based on evaluation_id
    - Re-backfill data with corrected constraint
*/

-- Drop the old constraint
ALTER TABLE speech_evaluation_items 
DROP CONSTRAINT IF EXISTS unique_speaker_per_evaluation_session;

-- Add new constraint based on evaluation_id (each evaluation should appear once)
ALTER TABLE speech_evaluation_items
ADD CONSTRAINT unique_evaluation_per_session UNIQUE (agenda_item_id, evaluation_id);

-- Now re-insert the ice breaker evaluation that was blocked before
INSERT INTO speech_evaluation_items (
  agenda_item_id,
  meeting_id,
  club_id,
  evaluation_id,
  speaker_id,
  speaker_name,
  speech_title,
  pathway_name,
  project_name,
  project_number,
  level,
  speech_category,
  evaluator_id,
  evaluator_name,
  display_order
)
SELECT 
  mai.id as agenda_item_id,
  apse.meeting_id,
  apse.club_id,
  apse.id as evaluation_id,
  apse.speaker_id,
  COALESCE(speaker.full_name, 'Unknown Speaker') as speaker_name,
  COALESCE(apse.speech_title, 'Untitled Speech') as speech_title,
  apse.pathway_name,
  apse.project_name,
  apse.project_number,
  apse.level,
  apse.speech_category,
  apse.evaluator_id,
  evaluator.full_name as evaluator_name,
  ROW_NUMBER() OVER (PARTITION BY mai.id ORDER BY apse.created_at) as display_order
FROM app_prepared_speech_evaluations apse
LEFT JOIN app_user_profiles speaker ON apse.speaker_id = speaker.id
LEFT JOIN app_user_profiles evaluator ON apse.evaluator_id = evaluator.id
INNER JOIN meeting_agenda_items mai ON mai.meeting_id = apse.meeting_id
WHERE mai.section_name = 'Speech Evaluation Session'
AND NOT EXISTS (
  SELECT 1 FROM speech_evaluation_items sei
  WHERE sei.evaluation_id = apse.id
)
ON CONFLICT (agenda_item_id, evaluation_id) DO NOTHING;
