/*
  # Create Word of the Day Feature for Grammarian

  ## Summary
  Creates a new table to store Word of the Day entries with meaning, usage examples,
  and publishing status. This allows grammarians to prepare entries and publish them
  when ready for all members to view.

  ## Changes
  1. New Table: `grammarian_word_of_the_day`
     - `id` (uuid, primary key)
     - `meeting_id` (uuid, foreign key to app_club_meeting)
     - `club_id` (uuid, foreign key to clubs)
     - `grammarian_user_id` (uuid, foreign key to app_user_profiles)
     - `word` (text, the word of the day)
     - `meaning` (text, definition/meaning of the word)
     - `usage` (text, usage example)
     - `is_published` (boolean, controls visibility)
     - `created_at` (timestamp)
     - `updated_at` (timestamp)

  ## Security
  - Enable RLS on the table
  - Grammarian can create and update their own entries
  - All club members can view published entries
  - Only grammarian can view unpublished entries

  ## Performance
  - Indexes on meeting_id, club_id, grammarian_user_id
  - Index on is_published for filtering
*/

-- Create grammarian_word_of_the_day table
CREATE TABLE IF NOT EXISTS grammarian_word_of_the_day (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  club_id uuid NOT NULL,
  grammarian_user_id uuid NOT NULL,
  word text NOT NULL,
  meaning text,
  usage text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT fk_word_of_the_day_meeting_id
    FOREIGN KEY (meeting_id) REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  CONSTRAINT fk_word_of_the_day_club_id
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_word_of_the_day_grammarian_id
    FOREIGN KEY (grammarian_user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_word_per_meeting
    UNIQUE (meeting_id),
  CONSTRAINT chk_word_not_empty
    CHECK (length(trim(word)) > 0),
  CONSTRAINT chk_meaning_length
    CHECK (meaning IS NULL OR length(meaning) <= 500),
  CONSTRAINT chk_usage_length
    CHECK (usage IS NULL OR length(usage) <= 500)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_word_of_the_day_meeting_id ON grammarian_word_of_the_day(meeting_id);
CREATE INDEX IF NOT EXISTS idx_word_of_the_day_club_id ON grammarian_word_of_the_day(club_id);
CREATE INDEX IF NOT EXISTS idx_word_of_the_day_grammarian_id ON grammarian_word_of_the_day(grammarian_user_id);
CREATE INDEX IF NOT EXISTS idx_word_of_the_day_published ON grammarian_word_of_the_day(is_published);

-- Enable Row Level Security
ALTER TABLE grammarian_word_of_the_day ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Grammarian can view their own entries (published or not)
CREATE POLICY "Grammarian can view own word of the day"
  ON grammarian_word_of_the_day
  FOR SELECT
  TO authenticated
  USING (
    grammarian_user_id = auth.uid()
  );

-- RLS Policy: Club members can view published entries
CREATE POLICY "Club members can view published word of the day"
  ON grammarian_word_of_the_day
  FOR SELECT
  TO authenticated
  USING (
    is_published = true AND
    club_id IN (
      SELECT club_id
      FROM app_club_user_relationship
      WHERE user_id = auth.uid()
        AND is_authenticated = true
    )
  );

-- RLS Policy: Grammarian can insert entries for their meetings
CREATE POLICY "Grammarian can insert word of the day"
  ON grammarian_word_of_the_day
  FOR INSERT
  TO authenticated
  WITH CHECK (
    grammarian_user_id = auth.uid() AND
    club_id IN (
      SELECT club_id
      FROM app_club_user_relationship
      WHERE user_id = auth.uid()
        AND is_authenticated = true
    )
  );

-- RLS Policy: Grammarian can update their own entries
CREATE POLICY "Grammarian can update own word of the day"
  ON grammarian_word_of_the_day
  FOR UPDATE
  TO authenticated
  USING (grammarian_user_id = auth.uid())
  WITH CHECK (grammarian_user_id = auth.uid());

-- RLS Policy: Grammarian can delete their own entries
CREATE POLICY "Grammarian can delete own word of the day"
  ON grammarian_word_of_the_day
  FOR DELETE
  TO authenticated
  USING (grammarian_user_id = auth.uid());

-- Create trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_word_of_the_day_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_word_of_the_day_updated_at
  BEFORE UPDATE ON grammarian_word_of_the_day
  FOR EACH ROW
  EXECUTE FUNCTION update_word_of_the_day_updated_at();

-- Add comment
COMMENT ON TABLE grammarian_word_of_the_day IS 'Stores Word of the Day entries created by grammarians for meetings';
COMMENT ON COLUMN grammarian_word_of_the_day.word IS 'The word of the day';
COMMENT ON COLUMN grammarian_word_of_the_day.meaning IS 'Definition or meaning of the word';
COMMENT ON COLUMN grammarian_word_of_the_day.usage IS 'Example usage of the word';
COMMENT ON COLUMN grammarian_word_of_the_day.is_published IS 'Whether the word is published and visible to all members';
