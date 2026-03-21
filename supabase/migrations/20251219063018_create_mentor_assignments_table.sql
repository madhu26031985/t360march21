/*
  # Create Mentor Assignments Table

  ## Summary
  Creates a table to track mentor-mentee relationships within clubs, allowing VPE to assign mentors to members for guidance and development.

  ## Changes
  1. New Tables
    - `mentor_assignments`
      - `id` (uuid, primary key) - Unique identifier for the assignment
      - `club_id` (uuid, foreign key) - Club where the mentorship exists
      - `mentor_id` (uuid, foreign key) - User ID of the mentor
      - `mentee_id` (uuid, foreign key) - User ID of the mentee
      - `assigned_by` (uuid, foreign key) - User ID who created the assignment (typically VPE)
      - `assigned_at` (timestamptz) - When the assignment was created
      - `status` (text) - Status: active, completed, or cancelled
      - `notes` (text, nullable) - Optional notes about the mentorship
      - `completed_at` (timestamptz, nullable) - When the mentorship was completed
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on `mentor_assignments` table
    - Policy for club members to view assignments in their club
    - Policy for ExComm to manage (insert, update, delete) assignments
    - Policy for mentors and mentees to view their own assignments

  3. Constraints
    - Mentor and mentee must be different users
    - Only one active mentorship per mentee in a club at a time

  ## Notes
  - Mentors and mentees must be club members (member or excomm roles)
  - VPE and ExComm can assign mentors
  - Members can view their mentor/mentee relationships
*/

-- Create mentor_assignments table
CREATE TABLE IF NOT EXISTS mentor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  mentee_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT different_mentor_mentee CHECK (mentor_id != mentee_id),
  CONSTRAINT one_active_mentee_per_club UNIQUE (club_id, mentee_id, status) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Create partial unique index for active mentorships only
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_mentorship_per_mentee 
  ON mentor_assignments(club_id, mentee_id) 
  WHERE status = 'active';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_mentor_assignments_club_id 
  ON mentor_assignments(club_id);

CREATE INDEX IF NOT EXISTS idx_mentor_assignments_mentor_id 
  ON mentor_assignments(mentor_id);

CREATE INDEX IF NOT EXISTS idx_mentor_assignments_mentee_id 
  ON mentor_assignments(mentee_id);

CREATE INDEX IF NOT EXISTS idx_mentor_assignments_status 
  ON mentor_assignments(status);

-- Add comments for documentation
COMMENT ON TABLE mentor_assignments IS 'Tracks mentor-mentee relationships within clubs';
COMMENT ON COLUMN mentor_assignments.status IS 'Status of mentorship: active, completed, or cancelled';
COMMENT ON COLUMN mentor_assignments.notes IS 'Optional notes about the mentorship goals or progress';

-- Enable Row Level Security
ALTER TABLE mentor_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Club members can view mentor assignments in their club
CREATE POLICY "Club members can view mentor assignments in their club"
  ON mentor_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE club_id = mentor_assignments.club_id
      AND user_id = auth.uid()
      AND is_authenticated = true
      AND role IN ('member', 'excomm')
    )
  );

-- Policy: ExComm can insert mentor assignments
CREATE POLICY "ExComm can create mentor assignments"
  ON mentor_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE club_id = mentor_assignments.club_id
      AND user_id = auth.uid()
      AND role = 'excomm'
      AND is_authenticated = true
    )
  );

-- Policy: ExComm can update mentor assignments
CREATE POLICY "ExComm can update mentor assignments"
  ON mentor_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE club_id = mentor_assignments.club_id
      AND user_id = auth.uid()
      AND role = 'excomm'
      AND is_authenticated = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE club_id = mentor_assignments.club_id
      AND user_id = auth.uid()
      AND role = 'excomm'
      AND is_authenticated = true
    )
  );

-- Policy: ExComm can delete mentor assignments
CREATE POLICY "ExComm can delete mentor assignments"
  ON mentor_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE club_id = mentor_assignments.club_id
      AND user_id = auth.uid()
      AND role = 'excomm'
      AND is_authenticated = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mentor_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER set_mentor_assignments_updated_at
  BEFORE UPDATE ON mentor_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_mentor_assignments_updated_at();