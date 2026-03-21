/*
  # Create Meeting Attendance Snapshot System

  1. New Tables
    - `meeting_attendance_snapshots`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `user_id` (uuid, foreign key to app_user_profiles)
      - `club_id` (uuid, foreign key to clubs)
      - `user_full_name` (text, snapshot of user name)
      - `user_email` (text, snapshot of user email)
      - `user_role` (text, snapshot of user role)
      - `user_avatar_url` (text, snapshot of user avatar)
      - `meeting_date` (date, denormalized meeting date)
      - `meeting_title` (text, denormalized meeting title)
      - `meeting_number` (text, denormalized meeting number)
      - `attendance_status` (text, present/absent/late)
      - `attendance_marked_by` (uuid, who marked attendance)
      - `attendance_marked_at` (timestamp, when marked)
      - `is_attendance_open` (boolean, if attendance can be modified)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `meeting_attendance_snapshots` table
    - Add policy for ExComm members to manage attendance
    - Add policy for club members to view attendance
    - Add policy for users to view their own attendance records

  3. Functions
    - `populate_meeting_attendance_snapshots()` - Creates snapshots when meeting is created
    - `update_meeting_attendance_snapshots_updated_at()` - Updates timestamp on changes

  4. Triggers
    - Auto-populate attendance snapshots when meeting is created
    - Auto-update timestamps on changes

  5. Indexes
    - Optimized for querying by meeting, club, user, and date
*/

-- Create the meeting_attendance_snapshots table
CREATE TABLE IF NOT EXISTS meeting_attendance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Snapshot data (as it was at meeting creation time)
  user_full_name text NOT NULL,
  user_email text NOT NULL,
  user_role text NOT NULL,
  user_avatar_url text,
  
  -- Denormalized meeting data for easy querying
  meeting_date date NOT NULL,
  meeting_title text NOT NULL,
  meeting_number text,
  
  -- Attendance tracking
  attendance_status text NOT NULL DEFAULT 'present' CHECK (attendance_status IN ('present', 'absent', 'late')),
  attendance_marked_by uuid REFERENCES app_user_profiles(id) ON DELETE SET NULL,
  attendance_marked_at timestamptz,
  is_attendance_open boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one record per user per meeting
  UNIQUE(meeting_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_snapshots_meeting_id 
  ON meeting_attendance_snapshots(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_snapshots_user_id 
  ON meeting_attendance_snapshots(user_id);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_snapshots_club_id 
  ON meeting_attendance_snapshots(club_id);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_snapshots_meeting_date 
  ON meeting_attendance_snapshots(meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_snapshots_status 
  ON meeting_attendance_snapshots(attendance_status);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_snapshots_club_meeting 
  ON meeting_attendance_snapshots(club_id, meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_snapshots_open 
  ON meeting_attendance_snapshots(is_attendance_open) WHERE is_attendance_open = true;

-- Enable Row Level Security
ALTER TABLE meeting_attendance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Club members can view attendance within their club"
  ON meeting_attendance_snapshots
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

CREATE POLICY "ExComm members can manage attendance"
  ON meeting_attendance_snapshots
  FOR ALL
  TO authenticated
  USING (
    club_id IN (
      SELECT app_club_user_relationship.club_id
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.role = 'excomm'
        AND app_club_user_relationship.is_authenticated = true
    )
  )
  WITH CHECK (
    club_id IN (
      SELECT app_club_user_relationship.club_id
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.role = 'excomm'
        AND app_club_user_relationship.is_authenticated = true
    )
  );

CREATE POLICY "Users can view their own attendance records"
  ON meeting_attendance_snapshots
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_meeting_attendance_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating timestamps
CREATE TRIGGER trigger_update_meeting_attendance_snapshots_updated_at
  BEFORE UPDATE ON meeting_attendance_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_attendance_snapshots_updated_at();

-- Function to populate attendance snapshots when a meeting is created
CREATE OR REPLACE FUNCTION populate_meeting_attendance_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert attendance snapshots for all authenticated club members
  INSERT INTO meeting_attendance_snapshots (
    meeting_id,
    user_id,
    club_id,
    user_full_name,
    user_email,
    user_role,
    user_avatar_url,
    meeting_date,
    meeting_title,
    meeting_number,
    attendance_status,
    is_attendance_open
  )
  SELECT 
    NEW.id as meeting_id,
    aup.id as user_id,
    NEW.club_id,
    aup.full_name as user_full_name,
    aup.email as user_email,
    acur.role as user_role,
    aup.avatar_url as user_avatar_url,
    NEW.meeting_date,
    NEW.meeting_title,
    NEW.meeting_number,
    'present' as attendance_status, -- Default to present
    true as is_attendance_open
  FROM app_club_user_relationship acur
  JOIN app_user_profiles aup ON acur.user_id = aup.id
  WHERE acur.club_id = NEW.club_id
    AND acur.is_authenticated = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-populate attendance snapshots when meeting is created
CREATE TRIGGER trigger_populate_meeting_attendance_snapshots
  AFTER INSERT ON app_club_meeting
  FOR EACH ROW
  EXECUTE FUNCTION populate_meeting_attendance_snapshots();