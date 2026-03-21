/*
  # Create Keynote Speaker Table

  ## Summary
  Creates a table to store keynote speaker information for meetings, including speech details and preparation notes.

  ## Changes
  1. New Tables
    - `app_meeting_keynote_speaker`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `club_id` (uuid, foreign key to clubs)
      - `speaker_user_id` (uuid, foreign key to app_user_profiles)
      - `speech_title` (text, nullable)
      - `summary` (text, nullable)
      - `notes` (text, nullable) - private prep notes (max 1500 words)
      - `is_completed` (boolean, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `app_meeting_keynote_speaker` table
    - Add policy for keynote speakers to view/manage their own content
    - Add policy for club members to view keynote content
    - Add policy for ExComm to manage keynote content

  ## Notes
  - Replicates the structure of app_meeting_educational_speaker
  - Allows keynote speakers to add speech title, summary, and preparation notes
  - Private notes are only accessible to the assigned keynote speaker
*/

-- Create the keynote speaker table
CREATE TABLE IF NOT EXISTS app_meeting_keynote_speaker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  speaker_user_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  speech_title text,
  summary text,
  notes text,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_keynote_speaker_meeting_id ON app_meeting_keynote_speaker(meeting_id);
CREATE INDEX IF NOT EXISTS idx_keynote_speaker_club_id ON app_meeting_keynote_speaker(club_id);
CREATE INDEX IF NOT EXISTS idx_keynote_speaker_user_id ON app_meeting_keynote_speaker(speaker_user_id);

-- Add unique constraint to ensure one keynote speaker per meeting
CREATE UNIQUE INDEX IF NOT EXISTS idx_keynote_speaker_unique_meeting 
ON app_meeting_keynote_speaker(meeting_id, speaker_user_id);

-- Add comments for documentation
COMMENT ON TABLE app_meeting_keynote_speaker IS 
  'Stores keynote speaker information for meetings including speech details and private preparation notes';

COMMENT ON COLUMN app_meeting_keynote_speaker.speech_title IS 
  'Title of the keynote speech';

COMMENT ON COLUMN app_meeting_keynote_speaker.summary IS 
  'Summary of the keynote speech content (max 500 words)';

COMMENT ON COLUMN app_meeting_keynote_speaker.notes IS 
  'Private preparation notes for the keynote speaker (max 1500 words)';

-- Enable Row Level Security
ALTER TABLE app_meeting_keynote_speaker ENABLE ROW LEVEL SECURITY;

-- Policy: Keynote speakers can view and manage their own content
CREATE POLICY "Keynote speakers can manage own content"
  ON app_meeting_keynote_speaker
  FOR ALL
  TO authenticated
  USING (speaker_user_id = auth.uid())
  WITH CHECK (speaker_user_id = auth.uid());

-- Policy: Club members can view keynote content
CREATE POLICY "Club members can view keynote content"
  ON app_meeting_keynote_speaker
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = app_meeting_keynote_speaker.club_id
        AND app_club_user_relationship.user_id = auth.uid()
    )
  );

-- Policy: ExComm members can manage all keynote content
CREATE POLICY "ExComm can manage keynote content"
  ON app_meeting_keynote_speaker
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = app_meeting_keynote_speaker.club_id
        AND app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.role = 'excomm'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = app_meeting_keynote_speaker.club_id
        AND app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.role = 'excomm'
    )
  );
