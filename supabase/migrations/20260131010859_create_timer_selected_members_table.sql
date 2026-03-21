/*
  # Create Timer Selected Members Table

  1. New Tables
    - `app_timer_selected_members`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `club_id` (uuid, foreign key to clubs)
      - `timer_user_id` (uuid, foreign key to app_user_profiles) - the timer who made the selection
      - `selected_member_id` (uuid, foreign key to app_user_profiles) - the member selected for tracking
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `app_timer_selected_members` table
    - Add policy for timers to manage their own selections
    - Add policy for timers to view their selections

  3. Indexes
    - Index on meeting_id and timer_user_id for fast lookups
    - Unique constraint on (meeting_id, timer_user_id, selected_member_id) to prevent duplicates
*/

-- Create the timer selected members table
CREATE TABLE IF NOT EXISTS app_timer_selected_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  timer_user_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  selected_member_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, timer_user_id, selected_member_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_timer_selected_members_meeting_timer 
  ON app_timer_selected_members(meeting_id, timer_user_id);

CREATE INDEX IF NOT EXISTS idx_timer_selected_members_club 
  ON app_timer_selected_members(club_id);

-- Enable RLS
ALTER TABLE app_timer_selected_members ENABLE ROW LEVEL SECURITY;

-- Policy: Timers can insert their own selections
CREATE POLICY "Timers can insert own member selections"
  ON app_timer_selected_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = timer_user_id);

-- Policy: Timers can view their own selections
CREATE POLICY "Timers can view own member selections"
  ON app_timer_selected_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = timer_user_id);

-- Policy: Timers can delete their own selections
CREATE POLICY "Timers can delete own member selections"
  ON app_timer_selected_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = timer_user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timer_selected_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_timer_selected_members_updated_at_trigger ON app_timer_selected_members;
CREATE TRIGGER update_timer_selected_members_updated_at_trigger
  BEFORE UPDATE ON app_timer_selected_members
  FOR EACH ROW
  EXECUTE FUNCTION update_timer_selected_members_updated_at();
