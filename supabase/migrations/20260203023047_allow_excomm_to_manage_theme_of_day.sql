/*
  # Allow ExComm to Manage Theme of the Day

  1. Changes
    - Update INSERT policy to allow ExComm members to add theme data
    - Update UPDATE policy to allow ExComm members to update theme data
    - Update DELETE policy to allow ExComm members to delete theme data

  2. Security
    - Assigned TMOD can still manage their own data
    - Any ExComm member can now also manage theme data for their club
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Toastmasters can insert their own data" ON toastmaster_meeting_data;
DROP POLICY IF EXISTS "Toastmasters can update their own data" ON toastmaster_meeting_data;
DROP POLICY IF EXISTS "Toastmasters can delete their own data" ON toastmaster_meeting_data;

-- Create new policy for INSERT: Assigned TMOD or ExComm can insert
CREATE POLICY "Assigned TMOD or ExComm can insert theme data"
  ON toastmaster_meeting_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = toastmaster_meeting_data.club_id
      AND app_club_user_relationship.user_id = auth.uid()
      AND (
        -- User is the assigned TMOD
        toastmaster_meeting_data.toastmaster_user_id = auth.uid()
        OR
        -- User is an ExComm member
        app_club_user_relationship.role = 'excomm'
      )
    )
  );

-- Create new policy for UPDATE: Assigned TMOD or ExComm can update
CREATE POLICY "Assigned TMOD or ExComm can update theme data"
  ON toastmaster_meeting_data
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = toastmaster_meeting_data.club_id
      AND app_club_user_relationship.user_id = auth.uid()
      AND (
        -- User is the assigned TMOD
        toastmaster_meeting_data.toastmaster_user_id = auth.uid()
        OR
        -- User is an ExComm member
        app_club_user_relationship.role = 'excomm'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = toastmaster_meeting_data.club_id
      AND app_club_user_relationship.user_id = auth.uid()
      AND (
        -- User is the assigned TMOD
        toastmaster_meeting_data.toastmaster_user_id = auth.uid()
        OR
        -- User is an ExComm member
        app_club_user_relationship.role = 'excomm'
      )
    )
  );

-- Create new policy for DELETE: Assigned TMOD or ExComm can delete
CREATE POLICY "Assigned TMOD or ExComm can delete theme data"
  ON toastmaster_meeting_data
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = toastmaster_meeting_data.club_id
      AND app_club_user_relationship.user_id = auth.uid()
      AND (
        -- User is the assigned TMOD
        toastmaster_meeting_data.toastmaster_user_id = auth.uid()
        OR
        -- User is an ExComm member
        app_club_user_relationship.role = 'excomm'
      )
    )
  );