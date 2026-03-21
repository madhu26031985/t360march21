/*
  # Create Grammarian Meeting Notes Table

  ## Summary
  Creates a table to store Grammarian's personal notes and prep space content for meetings.
  Similar to the Toastmaster notes functionality.

  ## Changes
  1. New Table: `grammarian_meeting_notes`
     - `id` (uuid, primary key)
     - `meeting_id` (uuid, foreign key to app_club_meeting)
     - `club_id` (uuid, foreign key to clubs)
     - `grammarian_user_id` (uuid, foreign key to app_user_profiles)
     - `personal_notes` (text, nullable - Grammarian's private prep notes)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on `grammarian_meeting_notes` table
  - Only the assigned grammarian can create, view, update, and delete their own notes
  - Notes are completely private to the grammarian

  ## Performance
  - Indexes on meeting_id, club_id, grammarian_user_id
  - Unique constraint on meeting_id + grammarian_user_id
*/

CREATE TABLE IF NOT EXISTS grammarian_meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  grammarian_user_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  personal_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, grammarian_user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_grammarian_meeting_notes_meeting ON grammarian_meeting_notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_grammarian_meeting_notes_club ON grammarian_meeting_notes(club_id);
CREATE INDEX IF NOT EXISTS idx_grammarian_meeting_notes_user ON grammarian_meeting_notes(grammarian_user_id);

-- Enable Row Level Security
ALTER TABLE grammarian_meeting_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Grammarian can view their own notes
CREATE POLICY "Grammarian can view own notes"
  ON grammarian_meeting_notes
  FOR SELECT
  TO authenticated
  USING (grammarian_user_id = auth.uid());

-- RLS Policy: Grammarian can insert their own notes
CREATE POLICY "Grammarian can insert own notes"
  ON grammarian_meeting_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    grammarian_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = grammarian_meeting_notes.club_id
      AND app_club_user_relationship.user_id = auth.uid()
    )
  );

-- RLS Policy: Grammarian can update their own notes
CREATE POLICY "Grammarian can update own notes"
  ON grammarian_meeting_notes
  FOR UPDATE
  TO authenticated
  USING (grammarian_user_id = auth.uid())
  WITH CHECK (grammarian_user_id = auth.uid());

-- RLS Policy: Grammarian can delete their own notes
CREATE POLICY "Grammarian can delete own notes"
  ON grammarian_meeting_notes
  FOR DELETE
  TO authenticated
  USING (grammarian_user_id = auth.uid());

-- Create trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_grammarian_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_grammarian_notes_updated_at
  BEFORE UPDATE ON grammarian_meeting_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_grammarian_notes_updated_at();

-- Add comment
COMMENT ON TABLE grammarian_meeting_notes IS 'Stores private prep space notes for grammarians for each meeting';
COMMENT ON COLUMN grammarian_meeting_notes.personal_notes IS 'Private notes for the grammarian to prepare for the meeting';
