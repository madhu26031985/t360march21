/*
  # Create Idiom and Quote of the Day Features for Grammarian

  ## Summary
  Creates two new tables to store Idiom of the Day and Quote of the Day entries
  with meaning, usage examples, and publishing status. This follows the same pattern
  as Word of the Day and allows grammarians to prepare entries and publish them
  when ready for all members to view.

  ## Changes
  1. New Table: `grammarian_idiom_of_the_day`
     - `id` (uuid, primary key)
     - `meeting_id` (uuid, foreign key to app_club_meeting)
     - `club_id` (uuid, foreign key to clubs)
     - `grammarian_user_id` (uuid, foreign key to app_user_profiles)
     - `idiom` (text, the idiom of the day)
     - `meaning` (text, definition/meaning of the idiom)
     - `usage` (text, usage example)
     - `is_published` (boolean, controls visibility)
     - `created_at` (timestamp)
     - `updated_at` (timestamp)

  2. New Table: `grammarian_quote_of_the_day`
     - `id` (uuid, primary key)
     - `meeting_id` (uuid, foreign key to app_club_meeting)
     - `club_id` (uuid, foreign key to clubs)
     - `grammarian_user_id` (uuid, foreign key to app_user_profiles)
     - `quote` (text, the quote of the day)
     - `meaning` (text, context/meaning of the quote)
     - `usage` (text, usage/application example)
     - `is_published` (boolean, controls visibility)
     - `created_at` (timestamp)
     - `updated_at` (timestamp)

  ## Security
  - Enable RLS on both tables
  - Grammarian can create and update their own entries
  - All club members can view published entries
  - Only grammarian can view unpublished entries

  ## Performance
  - Indexes on meeting_id, club_id, grammarian_user_id
  - Index on is_published for filtering
*/

-- Create grammarian_idiom_of_the_day table
CREATE TABLE IF NOT EXISTS grammarian_idiom_of_the_day (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  club_id uuid NOT NULL,
  grammarian_user_id uuid NOT NULL,
  idiom text NOT NULL,
  meaning text,
  usage text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT fk_idiom_of_the_day_meeting_id
    FOREIGN KEY (meeting_id) REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  CONSTRAINT fk_idiom_of_the_day_club_id
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_idiom_of_the_day_grammarian_id
    FOREIGN KEY (grammarian_user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_idiom_per_meeting
    UNIQUE (meeting_id),
  CONSTRAINT chk_idiom_not_empty
    CHECK (length(trim(idiom)) > 0),
  CONSTRAINT chk_idiom_meaning_length
    CHECK (meaning IS NULL OR length(meaning) <= 500),
  CONSTRAINT chk_idiom_usage_length
    CHECK (usage IS NULL OR length(usage) <= 500)
);

-- Create indexes for idiom table
CREATE INDEX IF NOT EXISTS idx_idiom_of_the_day_meeting_id ON grammarian_idiom_of_the_day(meeting_id);
CREATE INDEX IF NOT EXISTS idx_idiom_of_the_day_club_id ON grammarian_idiom_of_the_day(club_id);
CREATE INDEX IF NOT EXISTS idx_idiom_of_the_day_grammarian_id ON grammarian_idiom_of_the_day(grammarian_user_id);
CREATE INDEX IF NOT EXISTS idx_idiom_of_the_day_published ON grammarian_idiom_of_the_day(is_published);

-- Enable Row Level Security for idiom table
ALTER TABLE grammarian_idiom_of_the_day ENABLE ROW LEVEL SECURITY;

-- RLS Policies for idiom table
CREATE POLICY "Grammarian can view own idiom of the day"
  ON grammarian_idiom_of_the_day
  FOR SELECT
  TO authenticated
  USING (grammarian_user_id = auth.uid());

CREATE POLICY "Club members can view published idiom of the day"
  ON grammarian_idiom_of_the_day
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

CREATE POLICY "Grammarian can insert idiom of the day"
  ON grammarian_idiom_of_the_day
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

CREATE POLICY "Grammarian can update own idiom of the day"
  ON grammarian_idiom_of_the_day
  FOR UPDATE
  TO authenticated
  USING (grammarian_user_id = auth.uid())
  WITH CHECK (grammarian_user_id = auth.uid());

CREATE POLICY "Grammarian can delete own idiom of the day"
  ON grammarian_idiom_of_the_day
  FOR DELETE
  TO authenticated
  USING (grammarian_user_id = auth.uid());

-- Create grammarian_quote_of_the_day table
CREATE TABLE IF NOT EXISTS grammarian_quote_of_the_day (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  club_id uuid NOT NULL,
  grammarian_user_id uuid NOT NULL,
  quote text NOT NULL,
  meaning text,
  usage text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT fk_quote_of_the_day_meeting_id
    FOREIGN KEY (meeting_id) REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  CONSTRAINT fk_quote_of_the_day_club_id
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_quote_of_the_day_grammarian_id
    FOREIGN KEY (grammarian_user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_quote_per_meeting
    UNIQUE (meeting_id),
  CONSTRAINT chk_quote_not_empty
    CHECK (length(trim(quote)) > 0),
  CONSTRAINT chk_quote_meaning_length
    CHECK (meaning IS NULL OR length(meaning) <= 500),
  CONSTRAINT chk_quote_usage_length
    CHECK (usage IS NULL OR length(usage) <= 500)
);

-- Create indexes for quote table
CREATE INDEX IF NOT EXISTS idx_quote_of_the_day_meeting_id ON grammarian_quote_of_the_day(meeting_id);
CREATE INDEX IF NOT EXISTS idx_quote_of_the_day_club_id ON grammarian_quote_of_the_day(club_id);
CREATE INDEX IF NOT EXISTS idx_quote_of_the_day_grammarian_id ON grammarian_quote_of_the_day(grammarian_user_id);
CREATE INDEX IF NOT EXISTS idx_quote_of_the_day_published ON grammarian_quote_of_the_day(is_published);

-- Enable Row Level Security for quote table
ALTER TABLE grammarian_quote_of_the_day ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quote table
CREATE POLICY "Grammarian can view own quote of the day"
  ON grammarian_quote_of_the_day
  FOR SELECT
  TO authenticated
  USING (grammarian_user_id = auth.uid());

CREATE POLICY "Club members can view published quote of the day"
  ON grammarian_quote_of_the_day
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

CREATE POLICY "Grammarian can insert quote of the day"
  ON grammarian_quote_of_the_day
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

CREATE POLICY "Grammarian can update own quote of the day"
  ON grammarian_quote_of_the_day
  FOR UPDATE
  TO authenticated
  USING (grammarian_user_id = auth.uid())
  WITH CHECK (grammarian_user_id = auth.uid());

CREATE POLICY "Grammarian can delete own quote of the day"
  ON grammarian_quote_of_the_day
  FOR DELETE
  TO authenticated
  USING (grammarian_user_id = auth.uid());

-- Create trigger functions for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_idiom_of_the_day_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_quote_of_the_day_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_idiom_of_the_day_updated_at
  BEFORE UPDATE ON grammarian_idiom_of_the_day
  FOR EACH ROW
  EXECUTE FUNCTION update_idiom_of_the_day_updated_at();

CREATE TRIGGER trigger_update_quote_of_the_day_updated_at
  BEFORE UPDATE ON grammarian_quote_of_the_day
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_of_the_day_updated_at();

-- Add comments
COMMENT ON TABLE grammarian_idiom_of_the_day IS 'Stores Idiom of the Day entries created by grammarians for meetings';
COMMENT ON COLUMN grammarian_idiom_of_the_day.idiom IS 'The idiom of the day';
COMMENT ON COLUMN grammarian_idiom_of_the_day.meaning IS 'Definition or meaning of the idiom';
COMMENT ON COLUMN grammarian_idiom_of_the_day.usage IS 'Example usage of the idiom';
COMMENT ON COLUMN grammarian_idiom_of_the_day.is_published IS 'Whether the idiom is published and visible to all members';

COMMENT ON TABLE grammarian_quote_of_the_day IS 'Stores Quote of the Day entries created by grammarians for meetings';
COMMENT ON COLUMN grammarian_quote_of_the_day.quote IS 'The quote of the day';
COMMENT ON COLUMN grammarian_quote_of_the_day.meaning IS 'Context or meaning of the quote';
COMMENT ON COLUMN grammarian_quote_of_the_day.usage IS 'Example usage or application of the quote';
COMMENT ON COLUMN grammarian_quote_of_the_day.is_published IS 'Whether the quote is published and visible to all members';
