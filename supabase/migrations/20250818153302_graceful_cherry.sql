/*
  # Create app_meeting_attendance table for meeting attendance tracking

  1. New Tables
    - `app_meeting_attendance`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, references app_club_meeting)
      - `user_id` (uuid, references app_user_profiles)
      - `club_id` (uuid, references clubs)
      - `user_full_name` (text, snapshot of user name on meeting day)
      - `user_email` (text, snapshot of user email on meeting day)
      - `user_role` (text, snapshot of user role on meeting day)
      - `meeting_date` (date, denormalized for easy filtering)
      - `meeting_title` (text, denormalized for display)
      - `meeting_number` (text, denormalized for reference)
      - `attendance_status` (text, present/absent/late)
      - `attendance_marked_by` (uuid, who marked the attendance)
      - `attendance_marked_at` (timestamp, when attendance was marked)
      - `is_attendance_open` (boolean, whether attendance can still be marked)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `app_meeting_attendance` table
    - Add policy for club members to view attendance within their club
    - Add policy for ExComm members to manage attendance
    - Add policy for users to view their own attendance records

  3. Functions
    - `populate_meeting_attendance()` - Auto-populate attendance records for all club members
    - `close_meeting_attendance()` - Close attendance marking for a meeting
    - `reopen_meeting_attendance()` - Reopen attendance marking for a meeting
    - `update_app_meeting_attendance_updated_at()` - Update timestamp trigger

  4. Triggers
    - Auto-populate attendance when meeting is created
    - Auto-update timestamps on record changes
*/

-- Create the app_meeting_attendance table
CREATE TABLE IF NOT EXISTS app_meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  user_id uuid NOT NULL,
  club_id uuid NOT NULL,
  
  -- Snapshot data (preserved from the day of meeting)
  user_full_name text NOT NULL,
  user_email text NOT NULL,
  user_role text NOT NULL,
  
  -- Denormalized meeting data for easy querying
  meeting_date date NOT NULL,
  meeting_title text NOT NULL,
  meeting_number text,
  
  -- Attendance tracking
  attendance_status text DEFAULT 'present' CHECK (attendance_status IN ('present', 'absent', 'late')),
  attendance_marked_by uuid,
  attendance_marked_at timestamptz,
  is_attendance_open boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(meeting_id, user_id)
);

-- Add foreign key constraints
ALTER TABLE app_meeting_attendance 
ADD CONSTRAINT fk_app_meeting_attendance_meeting_id 
FOREIGN KEY (meeting_id) REFERENCES app_club_meeting(id) ON DELETE CASCADE;

ALTER TABLE app_meeting_attendance 
ADD CONSTRAINT fk_app_meeting_attendance_user_id 
FOREIGN KEY (user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

ALTER TABLE app_meeting_attendance 
ADD CONSTRAINT fk_app_meeting_attendance_club_id 
FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

ALTER TABLE app_meeting_attendance 
ADD CONSTRAINT fk_app_meeting_attendance_marked_by 
FOREIGN KEY (attendance_marked_by) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_meeting_attendance_meeting_id 
ON app_meeting_attendance(meeting_id);

CREATE INDEX IF NOT EXISTS idx_app_meeting_attendance_user_id 
ON app_meeting_attendance(user_id);

CREATE INDEX IF NOT EXISTS idx_app_meeting_attendance_club_id 
ON app_meeting_attendance(club_id);

CREATE INDEX IF NOT EXISTS idx_app_meeting_attendance_meeting_date 
ON app_meeting_attendance(meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_app_meeting_attendance_status 
ON app_meeting_attendance(attendance_status);

CREATE INDEX IF NOT EXISTS idx_app_meeting_attendance_open 
ON app_meeting_attendance(is_attendance_open) WHERE is_attendance_open = true;

CREATE INDEX IF NOT EXISTS idx_app_meeting_attendance_club_meeting 
ON app_meeting_attendance(club_id, meeting_id);

-- Enable Row Level Security
ALTER TABLE app_meeting_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Club members can view attendance within their club"
  ON app_meeting_attendance
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
      AND is_authenticated = true
    )
  );

CREATE POLICY "ExComm members can manage attendance"
  ON app_meeting_attendance
  FOR ALL
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
      AND role = 'excomm' 
      AND is_authenticated = true
    )
  )
  WITH CHECK (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
      AND role = 'excomm' 
      AND is_authenticated = true
    )
  );

CREATE POLICY "Users can view their own attendance records"
  ON app_meeting_attendance
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to populate attendance records for all club members when meeting is created
CREATE OR REPLACE FUNCTION populate_meeting_attendance()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert attendance records for all authenticated club members
  INSERT INTO app_meeting_attendance (
    meeting_id,
    user_id,
    club_id,
    user_full_name,
    user_email,
    user_role,
    meeting_date,
    meeting_title,
    meeting_number,
    attendance_status,
    is_attendance_open
  )
  SELECT 
    NEW.id,
    acur.user_id,
    NEW.club_id,
    aup.full_name,
    aup.email,
    acur.role,
    NEW.meeting_date,
    NEW.meeting_title,
    NEW.meeting_number,
    'present', -- Default to present
    true -- Attendance is open by default
  FROM app_club_user_relationship acur
  JOIN app_user_profiles aup ON acur.user_id = aup.id
  WHERE acur.club_id = NEW.club_id
  AND acur.is_authenticated = true
  AND aup.is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to close attendance for a meeting
CREATE OR REPLACE FUNCTION close_meeting_attendance(meeting_id_param uuid)
RETURNS void AS $$
BEGIN
  UPDATE app_meeting_attendance 
  SET 
    is_attendance_open = false,
    updated_at = now()
  WHERE meeting_id = meeting_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to reopen attendance for a meeting
CREATE OR REPLACE FUNCTION reopen_meeting_attendance(meeting_id_param uuid)
RETURNS void AS $$
BEGIN
  UPDATE app_meeting_attendance 
  SET 
    is_attendance_open = true,
    updated_at = now()
  WHERE meeting_id = meeting_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_meeting_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-populate attendance when meeting is created
CREATE TRIGGER trigger_populate_meeting_attendance
  AFTER INSERT ON app_club_meeting
  FOR EACH ROW
  EXECUTE FUNCTION populate_meeting_attendance();

-- Trigger to update updated_at timestamp
CREATE TRIGGER trigger_update_app_meeting_attendance_updated_at
  BEFORE UPDATE ON app_meeting_attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_app_meeting_attendance_updated_at();