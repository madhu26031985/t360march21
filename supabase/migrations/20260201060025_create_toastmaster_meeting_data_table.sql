/*
  # Create Toastmaster Meeting Data Table

  1. New Tables
    - `toastmaster_meeting_data`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `club_id` (uuid, foreign key to clubs)
      - `toastmaster_user_id` (uuid, foreign key to app_user_profiles)
      - `personal_notes` (text, nullable)
      - `theme_of_the_day` (text, nullable)
      - `theme_summary` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `toastmaster_meeting_data` table
    - Add policy for club members to read toastmaster data
    - Add policy for toastmasters to manage their own data
*/

CREATE TABLE IF NOT EXISTS toastmaster_meeting_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  toastmaster_user_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  personal_notes text,
  theme_of_the_day text,
  theme_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, toastmaster_user_id)
);

ALTER TABLE toastmaster_meeting_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view toastmaster data for their club"
  ON toastmaster_meeting_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = toastmaster_meeting_data.club_id
      AND app_club_user_relationship.user_id = auth.uid()
    )
  );

CREATE POLICY "Toastmasters can insert their own data"
  ON toastmaster_meeting_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    toastmaster_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = toastmaster_meeting_data.club_id
      AND app_club_user_relationship.user_id = auth.uid()
    )
  );

CREATE POLICY "Toastmasters can update their own data"
  ON toastmaster_meeting_data
  FOR UPDATE
  TO authenticated
  USING (toastmaster_user_id = auth.uid())
  WITH CHECK (toastmaster_user_id = auth.uid());

CREATE POLICY "Toastmasters can delete their own data"
  ON toastmaster_meeting_data
  FOR DELETE
  TO authenticated
  USING (toastmaster_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_toastmaster_meeting_data_meeting ON toastmaster_meeting_data(meeting_id);
CREATE INDEX IF NOT EXISTS idx_toastmaster_meeting_data_club ON toastmaster_meeting_data(club_id);
CREATE INDEX IF NOT EXISTS idx_toastmaster_meeting_data_user ON toastmaster_meeting_data(toastmaster_user_id);