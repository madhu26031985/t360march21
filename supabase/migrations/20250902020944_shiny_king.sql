/*
# Create Feedback Corner System

1. New Tables
  - `app_meeting_feedbackcorner`
    - `id` (uuid, primary key)
    - `meeting_id` (uuid, foreign key to app_club_meeting)
    - `club_id` (uuid, foreign key to clubs)
    - `user_id` (uuid, foreign key to app_user_profiles)
    - `overall_rating` (integer, 1-5)
    - `engagement_rating` (integer, 1-5)
    - `organization_rating` (integer, 1-5)
    - `environment_rating` (integer, 1-5)
    - `recommendation_rating` (integer, 1-5)
    - `comments` (text, max 1000 characters)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

2. Security
  - Enable RLS on `app_meeting_feedbackcorner` table
  - Add policies for authenticated users to read all feedback
  - Add policies for users to manage their own feedback
  - Add unique constraint to prevent duplicate feedback per user per meeting

3. Indexes
  - Add indexes for efficient querying by meeting, club, and user
  - Add composite indexes for common query patterns
*/

CREATE TABLE IF NOT EXISTS app_meeting_feedbackcorner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  club_id uuid NOT NULL,
  user_id uuid NOT NULL,
  overall_rating integer NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  engagement_rating integer NOT NULL CHECK (engagement_rating >= 1 AND engagement_rating <= 5),
  organization_rating integer NOT NULL CHECK (organization_rating >= 1 AND organization_rating <= 5),
  environment_rating integer NOT NULL CHECK (environment_rating >= 1 AND environment_rating <= 5),
  recommendation_rating integer NOT NULL CHECK (recommendation_rating >= 1 AND recommendation_rating <= 5),
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_feedback_comments_length CHECK (
    comments IS NULL OR length(comments) <= 1000
  ),
  CONSTRAINT unique_feedback_per_user_meeting UNIQUE (meeting_id, user_id)
);

-- Add foreign key constraints
ALTER TABLE app_meeting_feedbackcorner 
ADD CONSTRAINT fk_feedback_meeting_id 
FOREIGN KEY (meeting_id) REFERENCES app_club_meeting(id) ON DELETE CASCADE;

ALTER TABLE app_meeting_feedbackcorner 
ADD CONSTRAINT fk_feedback_club_id 
FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

ALTER TABLE app_meeting_feedbackcorner 
ADD CONSTRAINT fk_feedback_user_id 
FOREIGN KEY (user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_meeting_id ON app_meeting_feedbackcorner(meeting_id);
CREATE INDEX IF NOT EXISTS idx_feedback_club_id ON app_meeting_feedbackcorner(club_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON app_meeting_feedbackcorner(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON app_meeting_feedbackcorner(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_club_meeting ON app_meeting_feedbackcorner(club_id, meeting_id);

-- Enable Row Level Security
ALTER TABLE app_meeting_feedbackcorner ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Club members can read all feedback from their clubs"
  ON app_meeting_feedbackcorner
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "Users can insert their own feedback"
  ON app_meeting_feedbackcorner
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "Users can update their own feedback"
  ON app_meeting_feedbackcorner
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own feedback"
  ON app_meeting_feedbackcorner
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_feedback_updated_at
  BEFORE UPDATE ON app_meeting_feedbackcorner
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();