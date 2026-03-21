/*
  # Create ah_counter_notes table

  ## Purpose
  Stores personal prep notes for the Ah Counter role for each meeting.
  Only the assigned Ah Counter can read/write their own notes.

  ## New Tables
  - `ah_counter_notes`
    - `id` (uuid, primary key)
    - `meeting_id` (uuid, FK to app_club_meeting)
    - `club_id` (uuid, FK to clubs)
    - `ah_counter_user_id` (uuid, FK to auth.users)
    - `personal_notes` (text, nullable) — free-form prep notes
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Only the assigned Ah Counter can insert/select/update their own notes
*/

CREATE TABLE IF NOT EXISTS ah_counter_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL,
  ah_counter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personal_notes text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (meeting_id, ah_counter_user_id)
);

ALTER TABLE ah_counter_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ah counter can insert own notes"
  ON ah_counter_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = ah_counter_user_id);

CREATE POLICY "Ah counter can select own notes"
  ON ah_counter_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = ah_counter_user_id);

CREATE POLICY "Ah counter can update own notes"
  ON ah_counter_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = ah_counter_user_id)
  WITH CHECK (auth.uid() = ah_counter_user_id);
