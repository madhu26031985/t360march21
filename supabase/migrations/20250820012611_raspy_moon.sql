/*
  # Create Timer Reports Table

  1. New Tables
    - `timer_reports`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, references app_club_meeting)
      - `club_id` (uuid, references clubs)
      - `speaker_name` (text, required)
      - `speaker_user_id` (uuid, optional reference to app_user_profiles)
      - `speech_category` (text, enum: table_topic_speaker, prepared_speaker, evaluation, educational_session)
      - `actual_time_seconds` (integer, duration in seconds)
      - `actual_time_display` (text, formatted time MM:SS)
      - `time_qualification` (boolean, met time requirements)
      - `target_min_seconds` (integer, minimum time requirement)
      - `target_max_seconds` (integer, maximum time requirement)
      - `notes` (text, optional notes)
      - `recorded_by` (uuid, references app_user_profiles)
      - `recorded_at` (timestamp, when timing was recorded)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `timer_reports` table
    - Add policy for authenticated users to read timer reports from their clubs
    - Add policy for authenticated users to manage timer reports in their clubs

  3. Indexes
    - Index on meeting_id for fast meeting-based queries
    - Index on club_id for club-based filtering
    - Index on recorded_by for user-based queries
    - Index on speech_category for category filtering
    - Composite index on (meeting_id, speech_category) for meeting reports
*/

-- Create timer_reports table
CREATE TABLE IF NOT EXISTS timer_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  club_id uuid NOT NULL,
  speaker_name text NOT NULL,
  speaker_user_id uuid,
  speech_category text NOT NULL,
  actual_time_seconds integer NOT NULL DEFAULT 0,
  actual_time_display text NOT NULL DEFAULT '00:00',
  time_qualification boolean NOT NULL DEFAULT false,
  target_min_seconds integer,
  target_max_seconds integer,
  notes text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints
ALTER TABLE timer_reports ADD CONSTRAINT chk_timer_reports_speaker_name_not_empty 
  CHECK (speaker_name IS NOT NULL AND TRIM(speaker_name) <> '');

ALTER TABLE timer_reports ADD CONSTRAINT chk_timer_reports_valid_category 
  CHECK (speech_category IN ('table_topic_speaker', 'prepared_speaker', 'evaluation', 'educational_session'));

ALTER TABLE timer_reports ADD CONSTRAINT chk_timer_reports_positive_time 
  CHECK (actual_time_seconds >= 0);

ALTER TABLE timer_reports ADD CONSTRAINT chk_timer_reports_valid_time_display 
  CHECK (actual_time_display IS NOT NULL AND TRIM(actual_time_display) <> '');

ALTER TABLE timer_reports ADD CONSTRAINT chk_timer_reports_valid_target_times 
  CHECK (
    (target_min_seconds IS NULL OR target_min_seconds >= 0) AND
    (target_max_seconds IS NULL OR target_max_seconds >= 0) AND
    (target_min_seconds IS NULL OR target_max_seconds IS NULL OR target_max_seconds >= target_min_seconds)
  );

-- Add foreign key constraints
ALTER TABLE timer_reports ADD CONSTRAINT timer_reports_meeting_id_fkey 
  FOREIGN KEY (meeting_id) REFERENCES app_club_meeting(id) ON DELETE CASCADE;

ALTER TABLE timer_reports ADD CONSTRAINT timer_reports_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

ALTER TABLE timer_reports ADD CONSTRAINT timer_reports_speaker_user_id_fkey 
  FOREIGN KEY (speaker_user_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE timer_reports ADD CONSTRAINT timer_reports_recorded_by_fkey 
  FOREIGN KEY (recorded_by) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_timer_reports_meeting_id ON timer_reports(meeting_id);
CREATE INDEX IF NOT EXISTS idx_timer_reports_club_id ON timer_reports(club_id);
CREATE INDEX IF NOT EXISTS idx_timer_reports_recorded_by ON timer_reports(recorded_by);
CREATE INDEX IF NOT EXISTS idx_timer_reports_speech_category ON timer_reports(speech_category);
CREATE INDEX IF NOT EXISTS idx_timer_reports_recorded_at ON timer_reports(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_timer_reports_meeting_category ON timer_reports(meeting_id, speech_category);
CREATE INDEX IF NOT EXISTS idx_timer_reports_club_meeting ON timer_reports(club_id, meeting_id);

-- Enable Row Level Security
ALTER TABLE timer_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can read timer reports from their clubs"
  ON timer_reports
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "Authenticated users can manage timer reports in their clubs"
  ON timer_reports
  FOR ALL
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  )
  WITH CHECK (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_timer_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_timer_reports_updated_at
  BEFORE UPDATE ON timer_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_timer_reports_updated_at();