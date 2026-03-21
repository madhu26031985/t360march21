/*
  # Create Grammarian Live Meeting Tracking Tables

  1. New Tables
    - `grammarian_live_good_usage`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `club_id` (uuid, foreign key to clubs)
      - `grammarian_id` (uuid, foreign key to app_user_profiles)
      - `observation` (text, the good usage note)
      - `sequence_order` (integer, display order)
      - `created_at` (timestamptz)
    
    - `grammarian_live_improvements`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `club_id` (uuid, foreign key to clubs)
      - `grammarian_id` (uuid, foreign key to app_user_profiles)
      - `observation` (text, the improvement area note)
      - `sequence_order` (integer, display order)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for grammarian to manage their observations during live meetings
*/

-- Create grammarian_live_good_usage table
CREATE TABLE IF NOT EXISTS grammarian_live_good_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  grammarian_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  observation text NOT NULL,
  sequence_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create grammarian_live_improvements table
CREATE TABLE IF NOT EXISTS grammarian_live_improvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  grammarian_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  observation text NOT NULL,
  sequence_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE grammarian_live_good_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammarian_live_improvements ENABLE ROW LEVEL SECURITY;

-- Policies for grammarian_live_good_usage
CREATE POLICY "Grammarian can view own live good usage observations"
  ON grammarian_live_good_usage FOR SELECT
  TO authenticated
  USING (grammarian_id = auth.uid());

CREATE POLICY "Grammarian can insert own live good usage observations"
  ON grammarian_live_good_usage FOR INSERT
  TO authenticated
  WITH CHECK (grammarian_id = auth.uid());

CREATE POLICY "Grammarian can delete own live good usage observations"
  ON grammarian_live_good_usage FOR DELETE
  TO authenticated
  USING (grammarian_id = auth.uid());

-- Policies for grammarian_live_improvements
CREATE POLICY "Grammarian can view own live improvement observations"
  ON grammarian_live_improvements FOR SELECT
  TO authenticated
  USING (grammarian_id = auth.uid());

CREATE POLICY "Grammarian can insert own live improvement observations"
  ON grammarian_live_improvements FOR INSERT
  TO authenticated
  WITH CHECK (grammarian_id = auth.uid());

CREATE POLICY "Grammarian can delete own live improvement observations"
  ON grammarian_live_improvements FOR DELETE
  TO authenticated
  USING (grammarian_id = auth.uid());

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_grammarian_live_good_usage_meeting ON grammarian_live_good_usage(meeting_id, grammarian_id);
CREATE INDEX IF NOT EXISTS idx_grammarian_live_improvements_meeting ON grammarian_live_improvements(meeting_id, grammarian_id);