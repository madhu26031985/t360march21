/*
  # Create Feedback System

  1. New Tables
    - `feedback_requests`
      - `id` (uuid, primary key)
      - `requester_id` (uuid, references app_user_profiles)
      - `responder_id` (uuid, references app_user_profiles)
      - `feedback_type` (text, type of feedback)
      - `title` (text, feedback request title)
      - `description` (text, what feedback is needed)
      - `status` (text, pending/completed/cancelled)
      - `requested_at` (timestamp)
      - `responded_at` (timestamp, nullable)
      - `feedback_content` (text, nullable, the actual feedback)
      - `rating` (integer, nullable, 1-5 rating)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `feedback_requests` table
    - Add policies for users to manage their own feedback requests
    - Add policies for users to view feedback where they are requester or responder
*/

-- Create feedback_requests table
CREATE TABLE IF NOT EXISTS feedback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  feedback_type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  feedback_content text,
  rating integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints
ALTER TABLE feedback_requests 
ADD CONSTRAINT chk_feedback_requests_status 
CHECK (status IN ('pending', 'completed', 'cancelled'));

ALTER TABLE feedback_requests 
ADD CONSTRAINT chk_feedback_requests_feedback_type 
CHECK (feedback_type IN ('speech_evaluation', 'role_performance', 'leadership_skills', 'general_improvement', 'mentoring', 'general'));

ALTER TABLE feedback_requests 
ADD CONSTRAINT chk_feedback_requests_rating_range 
CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

ALTER TABLE feedback_requests 
ADD CONSTRAINT chk_feedback_requests_title_not_empty 
CHECK (title IS NOT NULL AND TRIM(title) <> '');

ALTER TABLE feedback_requests 
ADD CONSTRAINT chk_feedback_requests_description_not_empty 
CHECK (description IS NOT NULL AND TRIM(description) <> '');

-- Prevent self-feedback
ALTER TABLE feedback_requests 
ADD CONSTRAINT chk_feedback_requests_no_self_feedback 
CHECK (requester_id <> responder_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_requests_requester_id ON feedback_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_feedback_requests_responder_id ON feedback_requests(responder_id);
CREATE INDEX IF NOT EXISTS idx_feedback_requests_status ON feedback_requests(status);
CREATE INDEX IF NOT EXISTS idx_feedback_requests_feedback_type ON feedback_requests(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_requests_requested_at ON feedback_requests(requested_at DESC);

-- Enable RLS
ALTER TABLE feedback_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view feedback requests where they are involved"
  ON feedback_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = responder_id);

CREATE POLICY "Users can create feedback requests as requester"
  ON feedback_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update feedback requests where they are responder"
  ON feedback_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = responder_id)
  WITH CHECK (auth.uid() = responder_id);

CREATE POLICY "Users can update their own feedback requests"
  ON feedback_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id)
  WITH CHECK (auth.uid() = requester_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_feedback_requests_updated_at
  BEFORE UPDATE ON feedback_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_requests_updated_at();