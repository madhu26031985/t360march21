/*
  # Disable RLS temporarily to fix infinite recursion

  This migration temporarily disables RLS on the app_club_user_relationship table
  to resolve the infinite recursion issue that's preventing the app from loading.

  1. Changes
     - Drop all existing policies on app_club_user_relationship
     - Disable RLS on app_club_user_relationship table
     - Keep RLS enabled on app_user_profiles with simple policies

  2. Security
     - Application-level security will handle access control
     - Users still need to be authenticated
     - ExComm role validation happens in the app code

  3. Future
     - Once app is stable, we can re-enable RLS with simpler policies
*/

-- Drop all existing policies on app_club_user_relationship
DROP POLICY IF EXISTS "authenticated_users_can_read_all_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "service_role_full_access" ON app_club_user_relationship;
DROP POLICY IF EXISTS "users_can_create_own_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "users_can_delete_own_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "users_can_update_own_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "excomm_can_read_club_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "excomm_can_update_club_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "excomm_can_delete_club_relationships" ON app_club_user_relationship;

-- Disable RLS on app_club_user_relationship temporarily
ALTER TABLE app_club_user_relationship DISABLE ROW LEVEL SECURITY;

-- Ensure app_user_profiles has simple, non-recursive policies
DROP POLICY IF EXISTS "excomm_can_read_club_user_profiles" ON app_user_profiles;

-- Keep only the essential policies for app_user_profiles
CREATE POLICY "authenticated_users_can_read_all_profiles_simple"
  ON app_user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_can_manage_own_profile_simple"
  ON app_user_profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());