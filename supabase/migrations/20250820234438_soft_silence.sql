/*
  # Update Attendance Snapshot Policies

  1. Security Updates
    - Fix RLS policies to use auth.uid() instead of uid()
    - Ensure proper access control for members and ExComm
    - Add policies for self-attendance marking

  2. Policy Structure
    - Members can view their own attendance records
    - Members can update their own attendance status
    - ExComm can manage all attendance records within their club
    - Club members can view attendance within their club
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Club members can view attendance within their club" ON meeting_attendance_snapshots;
DROP POLICY IF EXISTS "ExComm members can manage attendance" ON meeting_attendance_snapshots;
DROP POLICY IF EXISTS "Users can view their own attendance records" ON meeting_attendance_snapshots;

-- Create new policies with correct auth function
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

CREATE POLICY "Members can mark their own attendance"
  ON meeting_attendance_snapshots
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can view their own attendance records"
  ON meeting_attendance_snapshots
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());