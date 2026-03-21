/*
  # Create Member Usage Tracking Tables for Grammarian Features

  ## Summary
  Creates tables to track individual member usage of Word/Idiom/Quote of the Day.
  Each member can have their own counter showing how many times they used the feature.

  ## Changes
  1. New Table: `grammarian_word_of_the_day_member_usage`
     - Tracks which members used the word and how many times
     - Links to word_of_the_day and app_user_profiles

  2. New Table: `grammarian_idiom_of_the_day_member_usage`
     - Tracks which members used the idiom and how many times
     - Links to idiom_of_the_day and app_user_profiles

  3. New Table: `grammarian_quote_of_the_day_member_usage`
     - Tracks which members used the quote and how many times
     - Links to quote_of_the_day and app_user_profiles

  ## Security
  - Enable RLS on all tables
  - Grammarian can insert, update, and delete tracking entries
  - All club members can view tracking data

  ## Performance
  - Indexes on foreign keys for fast lookups
  - Unique constraints to prevent duplicate member entries
*/

-- Create word of the day member usage table
CREATE TABLE IF NOT EXISTS grammarian_word_of_the_day_member_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_of_the_day_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT fk_word_member_usage_word_id
    FOREIGN KEY (word_of_the_day_id) REFERENCES grammarian_word_of_the_day(id) ON DELETE CASCADE,
  CONSTRAINT fk_word_member_usage_member_id
    FOREIGN KEY (member_user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_word_member
    UNIQUE (word_of_the_day_id, member_user_id),
  CONSTRAINT chk_word_member_usage_count_non_negative
    CHECK (usage_count >= 0)
);

-- Create idiom of the day member usage table
CREATE TABLE IF NOT EXISTS grammarian_idiom_of_the_day_member_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idiom_of_the_day_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT fk_idiom_member_usage_idiom_id
    FOREIGN KEY (idiom_of_the_day_id) REFERENCES grammarian_idiom_of_the_day(id) ON DELETE CASCADE,
  CONSTRAINT fk_idiom_member_usage_member_id
    FOREIGN KEY (member_user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_idiom_member
    UNIQUE (idiom_of_the_day_id, member_user_id),
  CONSTRAINT chk_idiom_member_usage_count_non_negative
    CHECK (usage_count >= 0)
);

-- Create quote of the day member usage table
CREATE TABLE IF NOT EXISTS grammarian_quote_of_the_day_member_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_of_the_day_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT fk_quote_member_usage_quote_id
    FOREIGN KEY (quote_of_the_day_id) REFERENCES grammarian_quote_of_the_day(id) ON DELETE CASCADE,
  CONSTRAINT fk_quote_member_usage_member_id
    FOREIGN KEY (member_user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_quote_member
    UNIQUE (quote_of_the_day_id, member_user_id),
  CONSTRAINT chk_quote_member_usage_count_non_negative
    CHECK (usage_count >= 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_word_member_usage_word_id ON grammarian_word_of_the_day_member_usage(word_of_the_day_id);
CREATE INDEX IF NOT EXISTS idx_word_member_usage_member_id ON grammarian_word_of_the_day_member_usage(member_user_id);

CREATE INDEX IF NOT EXISTS idx_idiom_member_usage_idiom_id ON grammarian_idiom_of_the_day_member_usage(idiom_of_the_day_id);
CREATE INDEX IF NOT EXISTS idx_idiom_member_usage_member_id ON grammarian_idiom_of_the_day_member_usage(member_user_id);

CREATE INDEX IF NOT EXISTS idx_quote_member_usage_quote_id ON grammarian_quote_of_the_day_member_usage(quote_of_the_day_id);
CREATE INDEX IF NOT EXISTS idx_quote_member_usage_member_id ON grammarian_quote_of_the_day_member_usage(member_user_id);

-- Enable RLS
ALTER TABLE grammarian_word_of_the_day_member_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammarian_idiom_of_the_day_member_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammarian_quote_of_the_day_member_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for word member usage
CREATE POLICY "Club members can view word member usage"
  ON grammarian_word_of_the_day_member_usage
  FOR SELECT
  TO authenticated
  USING (
    word_of_the_day_id IN (
      SELECT id FROM grammarian_word_of_the_day
      WHERE club_id IN (
        SELECT club_id FROM app_club_user_relationship
        WHERE user_id = auth.uid() AND is_authenticated = true
      )
    )
  );

CREATE POLICY "Grammarian can insert word member usage"
  ON grammarian_word_of_the_day_member_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (
    word_of_the_day_id IN (
      SELECT id FROM grammarian_word_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  );

CREATE POLICY "Grammarian can update word member usage"
  ON grammarian_word_of_the_day_member_usage
  FOR UPDATE
  TO authenticated
  USING (
    word_of_the_day_id IN (
      SELECT id FROM grammarian_word_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  )
  WITH CHECK (
    word_of_the_day_id IN (
      SELECT id FROM grammarian_word_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  );

CREATE POLICY "Grammarian can delete word member usage"
  ON grammarian_word_of_the_day_member_usage
  FOR DELETE
  TO authenticated
  USING (
    word_of_the_day_id IN (
      SELECT id FROM grammarian_word_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  );

-- RLS Policies for idiom member usage
CREATE POLICY "Club members can view idiom member usage"
  ON grammarian_idiom_of_the_day_member_usage
  FOR SELECT
  TO authenticated
  USING (
    idiom_of_the_day_id IN (
      SELECT id FROM grammarian_idiom_of_the_day
      WHERE club_id IN (
        SELECT club_id FROM app_club_user_relationship
        WHERE user_id = auth.uid() AND is_authenticated = true
      )
    )
  );

CREATE POLICY "Grammarian can insert idiom member usage"
  ON grammarian_idiom_of_the_day_member_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (
    idiom_of_the_day_id IN (
      SELECT id FROM grammarian_idiom_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  );

CREATE POLICY "Grammarian can update idiom member usage"
  ON grammarian_idiom_of_the_day_member_usage
  FOR UPDATE
  TO authenticated
  USING (
    idiom_of_the_day_id IN (
      SELECT id FROM grammarian_idiom_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  )
  WITH CHECK (
    idiom_of_the_day_id IN (
      SELECT id FROM grammarian_idiom_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  );

CREATE POLICY "Grammarian can delete idiom member usage"
  ON grammarian_idiom_of_the_day_member_usage
  FOR DELETE
  TO authenticated
  USING (
    idiom_of_the_day_id IN (
      SELECT id FROM grammarian_idiom_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  );

-- RLS Policies for quote member usage
CREATE POLICY "Club members can view quote member usage"
  ON grammarian_quote_of_the_day_member_usage
  FOR SELECT
  TO authenticated
  USING (
    quote_of_the_day_id IN (
      SELECT id FROM grammarian_quote_of_the_day
      WHERE club_id IN (
        SELECT club_id FROM app_club_user_relationship
        WHERE user_id = auth.uid() AND is_authenticated = true
      )
    )
  );

CREATE POLICY "Grammarian can insert quote member usage"
  ON grammarian_quote_of_the_day_member_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (
    quote_of_the_day_id IN (
      SELECT id FROM grammarian_quote_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  );

CREATE POLICY "Grammarian can update quote member usage"
  ON grammarian_quote_of_the_day_member_usage
  FOR UPDATE
  TO authenticated
  USING (
    quote_of_the_day_id IN (
      SELECT id FROM grammarian_quote_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  )
  WITH CHECK (
    quote_of_the_day_id IN (
      SELECT id FROM grammarian_quote_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  );

CREATE POLICY "Grammarian can delete quote member usage"
  ON grammarian_quote_of_the_day_member_usage
  FOR DELETE
  TO authenticated
  USING (
    quote_of_the_day_id IN (
      SELECT id FROM grammarian_quote_of_the_day
      WHERE grammarian_user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE grammarian_word_of_the_day_member_usage IS 'Tracks individual member usage of word of the day';
COMMENT ON TABLE grammarian_idiom_of_the_day_member_usage IS 'Tracks individual member usage of idiom of the day';
COMMENT ON TABLE grammarian_quote_of_the_day_member_usage IS 'Tracks individual member usage of quote of the day';
