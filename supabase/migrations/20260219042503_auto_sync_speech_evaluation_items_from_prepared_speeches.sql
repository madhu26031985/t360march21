/*
  # Auto-sync Speech Evaluation Items from Prepared Speeches
  
  1. Purpose
    - Automatically create/update speech evaluation items when:
      - A prepared speech evaluation record is created
      - An evaluator is assigned to a prepared speech
      - Speech details are updated
  
  2. Changes
    - Create trigger on app_prepared_speech_evaluations table
    - Sync speaker, evaluator, speech title, pathway info
    - Link to Speech Evaluation Session agenda item
  
  3. Notes
    - Ensures Speech Evaluation Session stays in sync with Prepared Speeches
    - Auto-generates evaluation items for seamless workflow
*/

-- Function to sync speech evaluation items when evaluations are created/updated
CREATE OR REPLACE FUNCTION sync_speech_evaluation_items()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_item_id uuid;
  v_speaker_name text;
  v_evaluator_name text;
  v_display_order integer;
BEGIN
  -- Find the Speech Evaluation Session agenda item for this meeting
  SELECT id INTO v_agenda_item_id
  FROM meeting_agenda_items
  WHERE meeting_id = NEW.meeting_id
  AND section_name = 'Speech Evaluation Session'
  LIMIT 1;
  
  -- If no Speech Evaluation Session exists, skip
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

-- Create trigger on INSERT and UPDATE of prepared speech evaluations
CREATE TRIGGER trigger_sync_speech_evaluation_items
  AFTER INSERT OR UPDATE ON app_prepared_speech_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION sync_speech_evaluation_items();

-- Function to remove evaluation item when evaluation is deleted
CREATE OR REPLACE FUNCTION remove_speech_evaluation_item()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM speech_evaluation_items
  WHERE evaluation_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on DELETE of prepared speech evaluations
CREATE TRIGGER trigger_remove_speech_evaluation_item
  AFTER DELETE ON app_prepared_speech_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION remove_speech_evaluation_item();
