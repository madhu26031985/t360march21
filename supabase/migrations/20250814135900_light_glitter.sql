/*
  # Fix club_profiles RLS policies for new table structure

  1. Security Updates
    - Drop existing RLS policies that reference old user_profiles table
    - Create new RLS policies that work with app_user_profiles and app_club_user_relationship tables
    - Allow ExComm members to manage their club profiles
    - Allow all authenticated users to read club profiles

  2. Policy Details
    - Read access: All authenticated users can view club profiles
    - Write access: Only ExComm members can update their club's profile
    - Uses app_club_user_relationship table to determine user roles
*/

-- Drop existing policies that reference the old table structure
DROP POLICY IF EXISTS "Authenticated users can read club profiles" ON club_profiles;
DROP POLICY IF EXISTS "ExComm members can manage their club profile" ON club_profiles;

-- Create new policy for reading club profiles (all authenticated users)
CREATE POLICY "authenticated_users_can_read_club_profiles"
  ON club_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create new policy for ExComm members to manage their club profile
CREATE POLICY "excomm_members_can_manage_club_profile"
  ON club_profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM app_club_user_relationship 
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.club_id = club_profiles.club_id
        AND app_club_user_relationship.role = 'excomm'
        AND app_club_user_relationship.is_authenticated = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM app_club_user_relationship 
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.club_id = club_profiles.club_id
        AND app_club_user_relationship.role = 'excomm'
        AND app_club_user_relationship.is_authenticated = true
    )
  );

-- Create policy for inserting new club profiles (ExComm members only)
CREATE POLICY "excomm_members_can_create_club_profile"
  ON club_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM app_club_user_relationship 
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.club_id = club_profiles.club_id
        AND app_club_user_relationship.role = 'excomm'
        AND app_club_user_relationship.is_authenticated = true
    )
  );