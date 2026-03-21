/*
  # Rename Speech Evaluation Session to Speech Evaluation

  - Renames "Speech Evaluation Session" to "Speech Evaluation" in templates and agenda items
  - Adds clipboard icon (📋) for Speech Evaluation
  - Updates sync_speech_evaluation_items function to use new section name
*/

BEGIN;

-- Update agenda_item_templates
UPDATE agenda_item_templates
SET section_name = 'Speech Evaluation',
    section_icon = '📋',
    updated_at = now()
WHERE section_name = 'Speech Evaluation Session';

-- Update meeting_agenda_items
UPDATE meeting_agenda_items
SET section_name = 'Speech Evaluation',
    section_icon = '📋',
    updated_at = now()
WHERE section_name = 'Speech Evaluation Session';

-- Update sync function to find "Speech Evaluation" section
CREATE OR REPLACE FUNCTION sync_speech_evaluation_items()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_item_id uuid;
  v_speaker_name text;
  v_evaluator_name text;
  v_display_order integer;
BEGIN
  -- Find the Speech Evaluation agenda item for this meeting
  SELECT id INTO v_agenda_item_id
  FROM meeting_agenda_items
  WHERE meeting_id = NEW.meeting_id
  AND section_name = 'Speech Evaluation'
  LIMIT 1;
  
  -- If no Speech Evaluation section exists, skip
  IF v_agenda_item_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get speaker name
  SELECT full_name INTO v_speaker_name
  FROM app_user_profiles
  WHERE id = NEW.speaker_id;
  
  -- Get evaluator name if assigned
  IF NEW.evaluator_id IS NOT NULL THEN
    SELECT full_name INTO v_evaluator_name
    FROM app_user_profiles
    WHERE id = NEW.evaluator_id;
  END IF;
  
  -- Calculate display order (next available order)
  SELECT COALESCE(MAX(display_order), 0) + 1 INTO v_display_order
  FROM speech_evaluation_items
  WHERE agenda_item_id = v_agenda_item_id;
  
  -- Insert or update speech evaluation item
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
  ) VALUES (
    v_agenda_item_id,
    NEW.meeting_id,
    NEW.club_id,
    NEW.id,
    NEW.speaker_id,
    COALESCE(v_speaker_name, 'Unknown Speaker'),
    COALESCE(NEW.speech_title, 'Untitled Speech'),
    NEW.pathway_name,
    NEW.project_name,
    NEW.project_number,
    NEW.level,
    NEW.speech_category,
    NEW.evaluator_id,
    v_evaluator_name,
    v_display_order
  )
  ON CONFLICT (agenda_item_id, speaker_id) 
  DO UPDATE SET
    speech_title = EXCLUDED.speech_title,
    pathway_name = EXCLUDED.pathway_name,
    project_name = EXCLUDED.project_name,
    project_number = EXCLUDED.project_number,
    level = EXCLUDED.level,
    speech_category = EXCLUDED.speech_category,
    evaluator_id = EXCLUDED.evaluator_id,
    evaluator_name = EXCLUDED.evaluator_name,
    evaluation_id = EXCLUDED.evaluation_id,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
