/*
  # Create Timer Notes Table

  1. New Tables
    - `app_meeting_timer_notes`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, references app_club_meeting)
      - `club_id` (uuid, references clubs)
      - `timer_user_id` (uuid, references app_user_profiles)
      - `personal_notes` (text, nullable) - Timer's private notes for the meeting
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `app_meeting_timer_notes` table
    - Add policies for timer users to manage their own notes
    
  3. Notes
    - This table allows timers to keep personal notes for each meeting
    - Notes are only visible to the assigned timer
    - Follows the same pattern as `app_meeting_toastmaster_notes`
*/

CREATE TABLE IF NOT EXISTS app_meeting_timer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES app_club_meeting(id) ON DELETE CASCADE NOT NULL,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  timer_user_id uuid REFERENCES app_user_profiles(id) ON DELETE CASCADE NOT NULL,
  personal_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, timer_user_id)
);

-- Enable RLS
ALTER TABLE app_meeting_timer_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Timer can view their own notes
CREATE POLICY "Timer can view own notes"
  ON app_meeting_timer_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = timer_user_id);

-- Policy: Timer can insert their own notes  
CREATE POLICY "Timer can insert own notes"
  ON app_meeting_timer_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = timer_user_id);

-- Policy: Timer can update their own notes
CREATE POLICY "Timer can update own notes"
  ON app_meeting_timer_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = timer_user_id)
  WITH CHECK (auth.uid() = timer_user_id);

-- Policy: Timer can delete their own notes
CREATE POLICY "Timer can delete own notes"
  ON app_meeting_timer_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = timer_user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_timer_notes_meeting_user 
  ON app_meeting_timer_notes(meeting_id, timer_user_id);

CREATE INDEX IF NOT EXISTS idx_timer_notes_club 
  ON app_meeting_timer_notes(club_id);
