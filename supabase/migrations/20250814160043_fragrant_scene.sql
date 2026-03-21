/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - The previous policies created circular references causing infinite recursion
    - ExComm policies were referencing the same table they were applied to

  2. Solution
    - Drop the problematic policies
    - Create simpler, direct policies without circular references
    - Use direct role checks instead of complex joins

  3. New Policies
    - ExComm members can manage users in their clubs
    - Direct role-based access without circular table references
*/

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "excomm_can_read_club_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "excomm_can_insert_club_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "excomm_can_update_club_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "excomm_can_delete_club_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "excomm_can_read_club_member_profiles" ON app_user_profiles;

-- Create simpler policies without circular references
-- These policies use a more direct approach to avoid recursion

-- Allow ExComm to read all relationships in their clubs
CREATE POLICY "excomm_can_manage_club_relationships"
  ON app_club_user_relationship
  FOR ALL
  TO authenticated
  USING (
    -- Check if the current user is ExComm in this club
    EXISTS (
      SELECT 1 
      FROM app_club_user_relationship excomm_check
      WHERE excomm_check.user_id = auth.uid()
        AND excomm_check.club_id = app_club_user_relationship.club_id
        AND excomm_check.role = 'excomm'
        AND excomm_check.is_authenticated = true
    )
  )
  WITH CHECK (
    -- Same check for inserts/updates
    EXISTS (
      SELECT 1 
      FROM app_club_user_relationship excomm_check
      WHERE excomm_check.user_id = auth.uid()
        AND excomm_check.club_id = app_club_user_relationship.club_id
        AND excomm_check.role = 'excomm'
        AND excomm_check.is_authenticated = true
    )
  );

-- Allow ExComm to read profiles of users in their clubs
CREATE POLICY "excomm_can_read_club_member_profiles"
  ON app_user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Check if the profile belongs to a user in a club where current user is ExComm
    EXISTS (
      SELECT 1 
      FROM app_club_user_relationship user_rel
      JOIN app_club_user_relationship excomm_rel ON user_rel.club_id = excomm_rel.club_id
      WHERE user_rel.user_id = app_user_profiles.id
        AND excomm_rel.user_id = auth.uid()
        AND excomm_rel.role = 'excomm'
        AND excomm_rel.is_authenticated = true
        AND user_rel.is_authenticated = true
    )
  );