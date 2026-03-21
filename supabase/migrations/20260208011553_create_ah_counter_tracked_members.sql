/*
  # Create Ah Counter Tracked Members Table

  1. New Tables
    - `ah_counter_tracked_members`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to meetings)
      - `club_id` (uuid, foreign key to clubs)
      - `user_id` (uuid, foreign key to app_user_profiles)
      - `created_at` (timestamp)
      - `created_by` (uuid, foreign key to app_user_profiles)
  
  2. Purpose
    - Store which members the Ah Counter is tracking during a meeting
    - Independent of attendance marking
    - Allows Ah Counter to select members at the start of meeting before attendance is marked
  
  3. Security
    - Enable RLS
    - ExComm and assigned Ah Counter can insert/update/delete
    - All club members can view
*/

-- Create the table
CREATE TABLE IF NOT EXISTS ah_counter_tracked_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES app_user_profiles(id) ON DELETE SET NULL,
  UNIQUE(meeting_id, user_id)
);

-- Enable RLS
ALTER TABLE ah_counter_tracked_members ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ah_counter_tracked_meeting ON ah_counter_tracked_members(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ah_counter_tracked_club ON ah_counter_tracked_members(club_id);
CREATE INDEX IF NOT EXISTS idx_ah_counter_tracked_user ON ah_counter_tracked_members(user_id);

-- Policy: Club members can view tracked members for their club
CREATE POLICY "Club members can view tracked members"
  ON ah_counter_tracked_members
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid()
      AND is_authenticated = true
    )
  );

-- Policy: ExComm can insert tracked members
CREATE POLICY "ExComm can insert tracked members"
  ON ah_counter_tracked_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() 
      AND role = 'excomm'
      AND is_authenticated = true
    )
  );

-- Policy: Assigned Ah Counter can insert tracked members
CREATE POLICY "Ah Counter can insert tracked members"
  ON ah_counter_tracked_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    meeting_id IN (
      SELECT meeting_id FROM app_meeting_roles_management
      WHERE assigned_user_id = auth.uid() 
      AND role_name = 'Ah Counter'
    )
  );

-- Policy: ExComm can delete tracked members
CREATE POLICY "ExComm can delete tracked members"
  ON ah_counter_tracked_members
  FOR DELETE
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() 
      AND role = 'excomm'
      AND is_authenticated = true
    )
  );

-- Policy: Assigned Ah Counter can delete tracked members
CREATE POLICY "Ah Counter can delete tracked members"
  ON ah_counter_tracked_members
  FOR DELETE
  TO authenticated
  USING (
    meeting_id IN (
      SELECT meeting_id FROM app_meeting_roles_management
      WHERE assigned_user_id = auth.uid() 
      AND role_name = 'Ah Counter'
    )
  );
