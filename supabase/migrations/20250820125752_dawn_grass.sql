/*
  # Create Ah Counter Reports Table

  1. New Tables
    - `ah_counter_reports`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `club_id` (uuid, foreign key to clubs)
      - `meeting_date` (date, denormalized from meeting)
      - `meeting_number` (text, denormalized from meeting)
      - `speaker_name` (text, required)
      - `speaker_user_id` (uuid, optional foreign key to app_user_profiles)
      - Filler word counters: um_count, uh_count, ah_count, er_count, hmm_count, like_count, so_count, well_count, okay_count, you_know_count
      - `repeated_words` (text, up to 500 characters)
      - `comments` (text, up to 1000 characters)
      - `recorded_by` (uuid, foreign key to app_user_profiles)
      - `recorded_at` (timestamptz, auto-generated)
      - `created_at` (timestamptz, auto-generated)
      - `updated_at` (timestamptz, auto-generated)

  2. Security
    - Enable RLS on `ah_counter_reports` table
    - Add policy for club members to read reports from their clubs
    - Add policy for authenticated users to insert their own reports
    - Add policy for report creators to update/delete their own reports

  3. Performance
    - Indexes on meeting_id, club_id, meeting_date, speaker_user_id, recorded_by
    - Composite index on (club_id, meeting_date) for efficient club-based queries

  4. Data Integrity
    - Check constraints for non-negative filler word counts
    - Check constraints for text field lengths
    - Foreign key constraints with appropriate cascade rules

  5. Automation
    - Trigger to auto-populate meeting_date and meeting_number from meeting data
    - Trigger to auto-populate club_id from meeting if not provided
    - Trigger to update updated_at timestamp on changes
*/

-- Create the ah_counter_reports table
CREATE TABLE IF NOT EXISTS ah_counter_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  club_id uuid NOT NULL,
  meeting_date date,
  meeting_number text,
  speaker_name text NOT NULL,
  speaker_user_id uuid,
  
  -- Filler word counters (10 types)
  um_count integer DEFAULT 0 NOT NULL,
  uh_count integer DEFAULT 0 NOT NULL,
  ah_count integer DEFAULT 0 NOT NULL,
  er_count integer DEFAULT 0 NOT NULL,
  hmm_count integer DEFAULT 0 NOT NULL,
  like_count integer DEFAULT 0 NOT NULL,
  so_count integer DEFAULT 0 NOT NULL,
  well_count integer DEFAULT 0 NOT NULL,
  okay_count integer DEFAULT 0 NOT NULL,
  you_know_count integer DEFAULT 0 NOT NULL,
  
  -- Text fields for additional observations
  repeated_words text,
  comments text,
  
  -- Metadata
  recorded_by uuid NOT NULL,
  recorded_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT chk_ah_counter_speaker_name_not_empty 
    CHECK (speaker_name IS NOT NULL AND TRIM(speaker_name) <> ''),
  CONSTRAINT chk_ah_counter_filler_counts_non_negative 
    CHECK (
      um_count >= 0 AND uh_count >= 0 AND ah_count >= 0 AND er_count >= 0 AND hmm_count >= 0 AND
      like_count >= 0 AND so_count >= 0 AND well_count >= 0 AND okay_count >= 0 AND you_know_count >= 0
    ),
  CONSTRAINT chk_ah_counter_repeated_words_length 
    CHECK (repeated_words IS NULL OR LENGTH(repeated_words) <= 500),
  CONSTRAINT chk_ah_counter_comments_length 
    CHECK (comments IS NULL OR LENGTH(comments) <= 1000)
);

-- Add foreign key constraints
ALTER TABLE ah_counter_reports 
  ADD CONSTRAINT ah_counter_reports_meeting_id_fkey 
  FOREIGN KEY (meeting_id) REFERENCES app_club_meeting(id) ON DELETE CASCADE;

ALTER TABLE ah_counter_reports 
  ADD CONSTRAINT ah_counter_reports_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

ALTER TABLE ah_counter_reports 
  ADD CONSTRAINT ah_counter_reports_speaker_user_id_fkey 
  FOREIGN KEY (speaker_user_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE ah_counter_reports 
  ADD CONSTRAINT ah_counter_reports_recorded_by_fkey 
  FOREIGN KEY (recorded_by) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_meeting_id 
  ON ah_counter_reports(meeting_id);

CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_club_id 
  ON ah_counter_reports(club_id);

CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_meeting_date 
  ON ah_counter_reports(meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_speaker_user_id 
  ON ah_counter_reports(speaker_user_id) WHERE speaker_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_recorded_by 
  ON ah_counter_reports(recorded_by);

CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_recorded_at 
  ON ah_counter_reports(recorded_at DESC);

-- Composite indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_club_meeting_date 
  ON ah_counter_reports(club_id, meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_meeting_speaker 
  ON ah_counter_reports(meeting_id, speaker_name);

-- Enable Row Level Security
ALTER TABLE ah_counter_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Club members can read ah counter reports from their clubs
CREATE POLICY "Club members can read ah counter reports from their clubs"
  ON ah_counter_reports
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT app_club_user_relationship.club_id
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.is_authenticated = true
    )
  );

-- Policy: Authenticated users can insert ah counter reports for their clubs
CREATE POLICY "Authenticated users can insert ah counter reports for their clubs"
  ON ah_counter_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    recorded_by = auth.uid() AND
    club_id IN (
      SELECT app_club_user_relationship.club_id
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.is_authenticated = true
    )
  );

-- Policy: Users can update their own ah counter reports
CREATE POLICY "Users can update their own ah counter reports"
  ON ah_counter_reports
  FOR UPDATE
  TO authenticated
  USING (recorded_by = auth.uid())
  WITH CHECK (recorded_by = auth.uid());

-- Policy: Users can delete their own ah counter reports
CREATE POLICY "Users can delete their own ah counter reports"
  ON ah_counter_reports
  FOR DELETE
  TO authenticated
  USING (recorded_by = auth.uid());

-- Create trigger function to auto-populate meeting data
CREATE OR REPLACE FUNCTION set_ah_counter_meeting_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate meeting_date and meeting_number from meeting data
  IF NEW.meeting_date IS NULL OR NEW.meeting_number IS NULL THEN
    SELECT meeting_date, meeting_number, club_id
    INTO NEW.meeting_date, NEW.meeting_number, NEW.club_id
    FROM app_club_meeting
    WHERE id = NEW.meeting_id;
  END IF;
  
  -- Auto-populate club_id if not provided
  IF NEW.club_id IS NULL THEN
    SELECT club_id
    INTO NEW.club_id
    FROM app_club_meeting
    WHERE id = NEW.meeting_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ah_counter_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_set_ah_counter_meeting_data
  BEFORE INSERT OR UPDATE ON ah_counter_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_ah_counter_meeting_data();

CREATE TRIGGER trigger_update_ah_counter_reports_updated_at
  BEFORE UPDATE ON ah_counter_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_ah_counter_reports_updated_at();

-- Create view for detailed ah counter reports with joins
CREATE OR REPLACE VIEW ah_counter_reports_with_details AS
SELECT 
  acr.*,
  m.meeting_title,
  m.meeting_mode,
  m.meeting_start_time,
  m.meeting_end_time,
  c.name as club_name,
  c.club_number,
  sp.full_name as speaker_full_name,
  sp.email as speaker_email,
  rec.full_name as recorded_by_name,
  rec.email as recorded_by_email,
  -- Calculate total filler words per speaker
  (acr.um_count + acr.uh_count + acr.ah_count + acr.er_count + acr.hmm_count + 
   acr.like_count + acr.so_count + acr.well_count + acr.okay_count + acr.you_know_count) as total_filler_words
FROM ah_counter_reports acr
LEFT JOIN app_club_meeting m ON acr.meeting_id = m.id
LEFT JOIN clubs c ON acr.club_id = c.id
LEFT JOIN app_user_profiles sp ON acr.speaker_user_id = sp.id
LEFT JOIN app_user_profiles rec ON acr.recorded_by = rec.id;

-- Create function to get meeting summary
CREATE OR REPLACE FUNCTION get_ah_counter_meeting_summary(p_meeting_id uuid)
RETURNS TABLE (
  meeting_title text,
  meeting_date date,
  club_name text,
  total_speakers bigint,
  total_filler_words bigint,
  average_filler_words_per_speaker numeric,
  most_common_filler_word text,
  most_common_filler_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH meeting_stats AS (
    SELECT 
      COUNT(*) as speaker_count,
      SUM(um_count + uh_count + ah_count + er_count + hmm_count + 
          like_count + so_count + well_count + okay_count + you_know_count) as total_words
    FROM ah_counter_reports
    WHERE meeting_id = p_meeting_id
  ),
  filler_word_totals AS (
    SELECT 
      'UM' as word_type, SUM(um_count) as count FROM ah_counter_reports WHERE meeting_id = p_meeting_id
    UNION ALL
    SELECT 'UH', SUM(uh_count) FROM ah_counter_reports WHERE meeting_id = p_meeting_id
    UNION ALL
    SELECT 'AH', SUM(ah_count) FROM ah_counter_reports WHERE meeting_id = p_meeting_id
    UNION ALL
    SELECT 'ER', SUM(er_count) FROM ah_counter_reports WHERE meeting_id = p_meeting_id
    UNION ALL
    SELECT 'HMM', SUM(hmm_count) FROM ah_counter_reports WHERE meeting_id = p_meeting_id
    UNION ALL
    SELECT 'LIKE', SUM(like_count) FROM ah_counter_reports WHERE meeting_id = p_meeting_id
    UNION ALL
    SELECT 'SO', SUM(so_count) FROM ah_counter_reports WHERE meeting_id = p_meeting_id
    UNION ALL
    SELECT 'WELL', SUM(well_count) FROM ah_counter_reports WHERE meeting_id = p_meeting_id
    UNION ALL
    SELECT 'OKAY', SUM(okay_count) FROM ah_counter_reports WHERE meeting_id = p_meeting_id
    UNION ALL
    SELECT 'YOU KNOW', SUM(you_know_count) FROM ah_counter_reports WHERE meeting_id = p_meeting_id
  ),
  top_filler_word AS (
    SELECT word_type, count
    FROM filler_word_totals
    WHERE count > 0
    ORDER BY count DESC
    LIMIT 1
  )
  SELECT 
    m.meeting_title,
    m.meeting_date,
    c.name,
    ms.speaker_count,
    ms.total_words,
    CASE 
      WHEN ms.speaker_count > 0 THEN ROUND(ms.total_words::numeric / ms.speaker_count, 2)
      ELSE 0
    END,
    tfw.word_type,
    tfw.count
  FROM app_club_meeting m
  LEFT JOIN clubs c ON m.club_id = c.id
  CROSS JOIN meeting_stats ms
  LEFT JOIN top_filler_word tfw ON true
  WHERE m.id = p_meeting_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;