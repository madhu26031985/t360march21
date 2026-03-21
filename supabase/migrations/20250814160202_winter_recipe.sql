/*
  # Remove problematic RLS policies causing infinite recursion

  1. Problem
    - The ExComm management policies are causing infinite recursion
    - App is completely broken and cannot load user data
    - Need to revert to working state immediately

  2. Solution
    - Drop all the problematic ExComm policies
    - Keep only the basic working policies
    - Restore app functionality first, then add proper policies later

  3. Security
    - Temporarily rely on application-level security
    - ExComm validation will be done in the app code
    - RLS still protects against unauthorized direct database access
*/

-- Drop all the problematic ExComm policies that are causing recursion
DROP POLICY IF EXISTS "excomm_can_manage_club_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "excomm_can_read_club_member_profiles" ON app_user_profiles;

-- Keep only the essential working policies
-- These are the original policies that were working before

-- For app_club_user_relationship table:
-- Keep: authenticated_users_can_read_all_relationships (SELECT)
-- Keep: users_can_create_own_relationships (INSERT)
-- Keep: users_can_update_own_relationships (UPDATE)
-- Keep: users_can_delete_own_relationships (DELETE)
-- Keep: service_role_full_access (ALL)

-- For app_user_profiles table:
-- Keep: authenticated_users_can_read_all_profiles (SELECT)
-- Keep: users_can_manage_own_profile (ALL)
-- Keep: service_role_full_access_profiles (ALL)

-- Note: The existing policies should be sufficient for basic functionality
-- ExComm management will be handled through application logic for now