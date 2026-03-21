/*
  # Create app_club_meeting table

  1. New Tables
    - `app_club_meeting`
      - `id` (uuid, primary key) - Meeting UUID
      - `club_id` (uuid, foreign key to clubs table)
      - `meeting_title` (text, not null)
      - `meeting_date` (date, not null)
      - `meeting_number` (text)
      - `meeting_start_time` (time)
      - `meeting_end_time` (time)
      - `meeting_duration` (interval, calculated field)
      - `meeting_mode` (text, enum: in_person, online, hybrid)
      - `meeting_location` (text)
      - `meeting_link` (text, for online/hybrid meetings)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `app_club_meeting` table
    - Add policy for authenticated users to manage meetings

  3. Constraints
    - Valid meeting mode options
    - Meeting title not empty
    - Foreign key relationship with clubs table
*/

CREATE TABLE IF NOT EXISTS app_club_meeting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  meeting_title text NOT NULL,
  meeting_date date NOT NULL,
  meeting_number text,
  meeting_start_time time,
  meeting_end_time time,
  meeting_duration interval GENERATED ALWAYS AS (
    CASE 
      WHEN meeting_start_time IS NOT NULL AND meeting_end_time IS NOT NULL 
      THEN meeting_end_time - meeting_start_time
      ELSE NULL
    END
  ) STORED,
  meeting_mode text DEFAULT 'in_person',
  meeting_location text,
  meeting_link text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_club_meeting ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to manage meetings
CREATE POLICY "Authenticated users can manage meetings"
  ON app_club_meeting
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policy for authenticated users to read meetings
CREATE POLICY "Authenticated users can read meetings"
  ON app_club_meeting
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_club_meeting_club_id 
  ON app_club_meeting (club_id);

CREATE INDEX IF NOT EXISTS idx_app_club_meeting_date 
  ON app_club_meeting (meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_app_club_meeting_mode 
  ON app_club_meeting (meeting_mode);

CREATE INDEX IF NOT EXISTS idx_app_club_meeting_created_at 
  ON app_club_meeting (created_at DESC);

-- Add foreign key constraint to clubs table
ALTER TABLE app_club_meeting 
ADD CONSTRAINT fk_app_club_meeting_club_id 
FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Add constraint for valid meeting modes
ALTER TABLE app_club_meeting 
ADD CONSTRAINT chk_app_club_meeting_valid_mode 
CHECK (meeting_mode IN ('in_person', 'online', 'hybrid'));

-- Add constraint to ensure meeting title is not empty
ALTER TABLE app_club_meeting 
ADD CONSTRAINT chk_app_club_meeting_title_not_empty 
CHECK (meeting_title IS NOT NULL AND TRIM(meeting_title) <> '');

-- Add constraint to ensure meeting times are logical
ALTER TABLE app_club_meeting 
ADD CONSTRAINT chk_app_club_meeting_time_order 
CHECK (
  meeting_start_time IS NULL OR 
  meeting_end_time IS NULL OR 
  meeting_end_time > meeting_start_time
);

-- Create trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_club_meeting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_app_club_meeting_updated_at
  BEFORE UPDATE ON app_club_meeting
  FOR EACH ROW
  EXECUTE FUNCTION update_app_club_meeting_updated_at();