/*
  # Grammarian Reports Database Schema

  1. New Tables
    - `grammarian_reports` - Main grammarian report table
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `club_id` (uuid, foreign key to clubs)
      - `word_of_the_day` (text, optional)
      - `recorded_by` (uuid, foreign key to app_user_profiles)
      - `meeting_date` (date, auto-populated from meeting)
      - `meeting_number` (text, auto-populated from meeting)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `grammarian_word_usage` - Word of the day usage tracking
      - `id` (uuid, primary key)
      - `grammarian_report_id` (uuid, foreign key)
      - `member_user_id` (uuid, optional foreign key to app_user_profiles)
      - `member_name` (text, required)
      - `usage_count` (integer, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `grammarian_good_usage` - Good usage examples and quotes
      - `id` (uuid, primary key)
      - `grammarian_report_id` (uuid, foreign key)
      - `member_user_id` (uuid, optional foreign key to app_user_profiles)
      - `member_name` (text, required)
      - `good_usage_text` (text, up to 500 characters)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `grammarian_suggestions` - Grammar improvement suggestions
      - `id` (uuid, primary key)
      - `grammarian_report_id` (uuid, foreign key)
      - `member_user_id` (uuid, optional foreign key to app_user_profiles)
      - `member_name` (text, required)
      - `improper_use` (text, up to 300 characters)
      - `suggestions` (text, up to 300 characters)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Club members can only access reports from their clubs
    - Users can only edit their own reports
    - Read access for all authenticated club members

  3. Performance
    - Indexes on meeting_id, club_id, recorded_by
    - Indexes on grammarian_report_id for related tables
    - Indexes on meeting_date for time-based queries

  4. Data Integrity
    - Foreign key constraints to ensure data consistency
    - Check constraints for text length limits
    - Unique constraint: one report per meeting
    - Auto-update triggers for timestamps
*/

-- Create grammarian_reports table
CREATE TABLE IF NOT EXISTS grammarian_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  club_id uuid NOT NULL,
  word_of_the_day text,
  recorded_by uuid NOT NULL,
  meeting_date date,
  meeting_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_grammarian_reports_meeting_id 
    FOREIGN KEY (meeting_id) REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  CONSTRAINT fk_grammarian_reports_club_id 
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_grammarian_reports_recorded_by 
    FOREIGN KEY (recorded_by) REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_grammarian_report_per_meeting 
    UNIQUE (meeting_id),
  CONSTRAINT chk_grammarian_word_length 
    CHECK (word_of_the_day IS NULL OR length(trim(word_of_the_day)) > 0)
);

-- Create grammarian_word_usage table
CREATE TABLE IF NOT EXISTS grammarian_word_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grammarian_report_id uuid NOT NULL,
  member_user_id uuid,
  member_name text NOT NULL,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_grammarian_word_usage_report_id 
    FOREIGN KEY (grammarian_report_id) REFERENCES grammarian_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_grammarian_word_usage_member_id 
    FOREIGN KEY (member_user_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_grammarian_word_usage_name_not_empty 
    CHECK (length(trim(member_name)) > 0),
  CONSTRAINT chk_grammarian_word_usage_count_non_negative 
    CHECK (usage_count >= 0)
);

-- Create grammarian_good_usage table
CREATE TABLE IF NOT EXISTS grammarian_good_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grammarian_report_id uuid NOT NULL,
  member_user_id uuid,
  member_name text NOT NULL,
  good_usage_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_grammarian_good_usage_report_id 
    FOREIGN KEY (grammarian_report_id) REFERENCES grammarian_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_grammarian_good_usage_member_id 
    FOREIGN KEY (member_user_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_grammarian_good_usage_name_not_empty 
    CHECK (length(trim(member_name)) > 0),
  CONSTRAINT chk_grammarian_good_usage_text_length 
    CHECK (good_usage_text IS NULL OR length(good_usage_text) <= 500)
);

-- Create grammarian_suggestions table
CREATE TABLE IF NOT EXISTS grammarian_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grammarian_report_id uuid NOT NULL,
  member_user_id uuid,
  member_name text NOT NULL,
  improper_use text,
  suggestions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_grammarian_suggestions_report_id 
    FOREIGN KEY (grammarian_report_id) REFERENCES grammarian_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_grammarian_suggestions_member_id 
    FOREIGN KEY (member_user_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_grammarian_suggestions_name_not_empty 
    CHECK (length(trim(member_name)) > 0),
  CONSTRAINT chk_grammarian_suggestions_improper_use_length 
    CHECK (improper_use IS NULL OR length(improper_use) <= 300),
  CONSTRAINT chk_grammarian_suggestions_suggestions_length 
    CHECK (suggestions IS NULL OR length(suggestions) <= 300)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_grammarian_reports_meeting_id ON grammarian_reports(meeting_id);
CREATE INDEX IF NOT EXISTS idx_grammarian_reports_club_id ON grammarian_reports(club_id);
CREATE INDEX IF NOT EXISTS idx_grammarian_reports_recorded_by ON grammarian_reports(recorded_by);
CREATE INDEX IF NOT EXISTS idx_grammarian_reports_meeting_date ON grammarian_reports(meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_grammarian_word_usage_report_id ON grammarian_word_usage(grammarian_report_id);
CREATE INDEX IF NOT EXISTS idx_grammarian_word_usage_member_id ON grammarian_word_usage(member_user_id);

CREATE INDEX IF NOT EXISTS idx_grammarian_good_usage_report_id ON grammarian_good_usage(grammarian_report_id);
CREATE INDEX IF NOT EXISTS idx_grammarian_good_usage_member_id ON grammarian_good_usage(member_user_id);

CREATE INDEX IF NOT EXISTS idx_grammarian_suggestions_report_id ON grammarian_suggestions(grammarian_report_id);
CREATE INDEX IF NOT EXISTS idx_grammarian_suggestions_member_id ON grammarian_suggestions(member_user_id);

-- Enable Row Level Security
ALTER TABLE grammarian_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammarian_word_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammarian_good_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammarian_suggestions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for grammarian_reports
CREATE POLICY "Club members can read grammarian reports from their clubs"
  ON grammarian_reports
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = (SELECT auth.uid()) 
        AND is_authenticated = true
    )
  );

CREATE POLICY "Users can insert grammarian reports for their clubs"
  ON grammarian_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    recorded_by = (SELECT auth.uid()) AND
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = (SELECT auth.uid()) 
        AND is_authenticated = true
    )
  );

CREATE POLICY "Users can update their own grammarian reports"
  ON grammarian_reports
  FOR UPDATE
  TO authenticated
  USING (recorded_by = (SELECT auth.uid()))
  WITH CHECK (recorded_by = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own grammarian reports"
  ON grammarian_reports
  FOR DELETE
  TO authenticated
  USING (recorded_by = (SELECT auth.uid()));

-- Create RLS policies for grammarian_word_usage
CREATE POLICY "Club members can read word usage from their clubs"
  ON grammarian_word_usage
  FOR SELECT
  TO authenticated
  USING (
    grammarian_report_id IN (
      SELECT id FROM grammarian_reports 
      WHERE club_id IN (
        SELECT club_id 
        FROM app_club_user_relationship 
        WHERE user_id = (SELECT auth.uid()) 
          AND is_authenticated = true
      )
    )
  );

CREATE POLICY "Users can manage word usage for their reports"
  ON grammarian_word_usage
  FOR ALL
  TO authenticated
  USING (
    grammarian_report_id IN (
      SELECT id FROM grammarian_reports 
      WHERE recorded_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    grammarian_report_id IN (
      SELECT id FROM grammarian_reports 
      WHERE recorded_by = (SELECT auth.uid())
    )
  );

-- Create RLS policies for grammarian_good_usage
CREATE POLICY "Club members can read good usage from their clubs"
  ON grammarian_good_usage
  FOR SELECT
  TO authenticated
  USING (
    grammarian_report_id IN (
      SELECT id FROM grammarian_reports 
      WHERE club_id IN (
        SELECT club_id 
        FROM app_club_user_relationship 
        WHERE user_id = (SELECT auth.uid()) 
          AND is_authenticated = true
      )
    )
  );

CREATE POLICY "Users can manage good usage for their reports"
  ON grammarian_good_usage
  FOR ALL
  TO authenticated
  USING (
    grammarian_report_id IN (
      SELECT id FROM grammarian_reports 
      WHERE recorded_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    grammarian_report_id IN (
      SELECT id FROM grammarian_reports 
      WHERE recorded_by = (SELECT auth.uid())
    )
  );

-- Create RLS policies for grammarian_suggestions
CREATE POLICY "Club members can read suggestions from their clubs"
  ON grammarian_suggestions
  FOR SELECT
  TO authenticated
  USING (
    grammarian_report_id IN (
      SELECT id FROM grammarian_reports 
      WHERE club_id IN (
        SELECT club_id 
        FROM app_club_user_relationship 
        WHERE user_id = (SELECT auth.uid()) 
          AND is_authenticated = true
      )
    )
  );

CREATE POLICY "Users can manage suggestions for their reports"
  ON grammarian_suggestions
  FOR ALL
  TO authenticated
  USING (
    grammarian_report_id IN (
      SELECT id FROM grammarian_reports 
      WHERE recorded_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    grammarian_report_id IN (
      SELECT id FROM grammarian_reports 
      WHERE recorded_by = (SELECT auth.uid())
    )
  );

-- Create trigger functions for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_grammarian_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_grammarian_word_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_grammarian_good_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_grammarian_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-populate meeting data
CREATE OR REPLACE FUNCTION set_grammarian_meeting_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate meeting_date and meeting_number from the meeting
  SELECT meeting_date, meeting_number
  INTO NEW.meeting_date, NEW.meeting_number
  FROM app_club_meeting
  WHERE id = NEW.meeting_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_grammarian_reports_updated_at
  BEFORE UPDATE ON grammarian_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_grammarian_reports_updated_at();

CREATE TRIGGER trigger_set_grammarian_meeting_data
  BEFORE INSERT OR UPDATE OF meeting_id ON grammarian_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_grammarian_meeting_data();

CREATE TRIGGER trigger_update_grammarian_word_usage_updated_at
  BEFORE UPDATE ON grammarian_word_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_grammarian_word_usage_updated_at();

CREATE TRIGGER trigger_update_grammarian_good_usage_updated_at
  BEFORE UPDATE ON grammarian_good_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_grammarian_good_usage_updated_at();

CREATE TRIGGER trigger_update_grammarian_suggestions_updated_at
  BEFORE UPDATE ON grammarian_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_grammarian_suggestions_updated_at();