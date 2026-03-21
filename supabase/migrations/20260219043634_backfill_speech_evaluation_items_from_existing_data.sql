/*
  # Backfill Speech Evaluation Items from Existing Data
  
  1. Purpose
    - Populate speech_evaluation_items table with existing prepared speech evaluations
    - This is needed because evaluations created before the trigger was added won't be synced
  
  2. Changes
    - Insert evaluation items for all existing evaluations
    - Link to Speech Evaluation Session agenda items
    - Populate speaker, evaluator, and speech details
  
  3. Notes
    - One-time backfill for historical data
    - Future evaluations will be auto-synced via trigger
*/

-- Backfill speech evaluation items for all existing evaluations
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
  -- Don't insert if already exists
  SELECT 1 FROM speech_evaluation_items sei
  WHERE sei.evaluation_id = apse.id
)
ON CONFLICT (agenda_item_id, speaker_id) DO NOTHING;
