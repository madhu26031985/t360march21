/*
  # Add Speech Evaluation Items Structure
  
  1. Purpose
    - Create a new table to track individual speech evaluations within the Speech Evaluation Session
    - Each prepared speech automatically gets a corresponding evaluation entry
    - Links evaluators to speakers and their speeches
  
  2. New Tables
    - `speech_evaluation_items`
      - Links to meeting_agenda_items (Speech Evaluation Session)
      - Links to app_prepared_speech_evaluations (the evaluation record)
      - Stores speaker, evaluator, speech details for display
      - Auto-generated based on Prepared Speech session roles
  
  3. Security
    - Enable RLS
    - Club members can view their club's evaluation items
    - ExComm can manage evaluation items
*/

-- Create speech_evaluation_items table
CREATE TABLE IF NOT EXISTS speech_evaluation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_item_id uuid NOT NULL REFERENCES meeting_agenda_items(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Link to the prepared speech evaluation record
  evaluation_id uuid REFERENCES app_prepared_speech_evaluations(id) ON DELETE SET NULL,
  
  -- Speaker information (from prepared speech)
  speaker_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  speaker_name text NOT NULL,
  speech_title text NOT NULL,
  
  -- Pathway information
  pathway_name text,
  project_name text,
  project_number text,
  level integer,
  speech_category text,
  
  -- Evaluator information
  evaluator_id uuid REFERENCES app_user_profiles(id) ON DELETE SET NULL,
  evaluator_name text,
  
  -- Display order within the evaluation session
  display_order integer NOT NULL DEFAULT 1,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_speaker_per_evaluation_session UNIQUE (agenda_item_id, speaker_id)
);

-- Enable RLS
ALTER TABLE speech_evaluation_items ENABLE ROW LEVEL SECURITY;

-- Club members can view evaluation items for their club
CREATE POLICY "Club members can view speech evaluation items"
  ON speech_evaluation_items
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship 
      WHERE user_id = auth.uid()
    )
  );

-- ExComm can insert evaluation items
CREATE POLICY "ExComm can insert speech evaluation items"
  ON speech_evaluation_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
      AND role = 'excomm'
    )
  );

-- ExComm can update evaluation items
CREATE POLICY "ExComm can update speech evaluation items"
  ON speech_evaluation_items
  FOR UPDATE
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
      AND role = 'excomm'
    )
  )
  WITH CHECK (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
      AND role = 'excomm'
    )
  );

-- ExComm can delete evaluation items
CREATE POLICY "ExComm can delete speech evaluation items"
  ON speech_evaluation_items
  FOR DELETE
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
      AND role = 'excomm'
    )
  );

-- Create indexes for performance
CREATE INDEX idx_speech_eval_items_agenda ON speech_evaluation_items(agenda_item_id);
CREATE INDEX idx_speech_eval_items_meeting ON speech_evaluation_items(meeting_id);
CREATE INDEX idx_speech_eval_items_speaker ON speech_evaluation_items(speaker_id);
CREATE INDEX idx_speech_eval_items_evaluator ON speech_evaluation_items(evaluator_id);
CREATE INDEX idx_speech_eval_items_evaluation ON speech_evaluation_items(evaluation_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_speech_evaluation_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_speech_evaluation_items_updated_at
  BEFORE UPDATE ON speech_evaluation_items
  FOR EACH ROW
  EXECUTE FUNCTION update_speech_evaluation_items_updated_at();
