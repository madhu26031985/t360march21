/*
  # Remove user_profiles table and use app_user_profiles

  1. Problem
    - user_profiles is an old/duplicate table that shouldn't exist
    - Multiple tables reference user_profiles instead of app_user_profiles
    - This causes confusion and data inconsistency

  2. Changes
    - Drop all foreign key constraints referencing user_profiles
    - Recreate them to reference app_user_profiles
    - Drop the sync trigger (no longer needed)
    - Drop the user_profiles table

  3. Affected Tables
    - club_profiles (8 foreign keys)
    - meetings, poll_votes, polls, resources
    - role_bookings, role_completions, speeches
    - user_management_audit, user_pathways, user_performance_metrics
*/

-- Drop all foreign key constraints referencing user_profiles
ALTER TABLE club_profiles DROP CONSTRAINT IF EXISTS club_profiles_ipp_id_fkey;
ALTER TABLE club_profiles DROP CONSTRAINT IF EXISTS club_profiles_vpe_id_fkey;
ALTER TABLE club_profiles DROP CONSTRAINT IF EXISTS club_profiles_vpm_id_fkey;
ALTER TABLE club_profiles DROP CONSTRAINT IF EXISTS club_profiles_vppr_id_fkey;
ALTER TABLE club_profiles DROP CONSTRAINT IF EXISTS club_profiles_secretary_id_fkey;
ALTER TABLE club_profiles DROP CONSTRAINT IF EXISTS club_profiles_president_id_fkey;
ALTER TABLE club_profiles DROP CONSTRAINT IF EXISTS club_profiles_treasurer_id_fkey;
ALTER TABLE club_profiles DROP CONSTRAINT IF EXISTS club_profiles_saa_id_fkey;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_created_by_fkey;
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_user_id_fkey;
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_created_by_fkey;
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_created_by_fkey;
ALTER TABLE role_bookings DROP CONSTRAINT IF EXISTS role_bookings_user_id_fkey;
ALTER TABLE role_completions DROP CONSTRAINT IF EXISTS role_completions_assigned_user_id_fkey;
ALTER TABLE speeches DROP CONSTRAINT IF EXISTS speeches_user_id_fkey;
ALTER TABLE user_management_audit DROP CONSTRAINT IF EXISTS user_management_audit_performed_by_fkey;
ALTER TABLE user_pathways DROP CONSTRAINT IF EXISTS user_pathways_user_id_fkey;
ALTER TABLE user_performance_metrics DROP CONSTRAINT IF EXISTS fk_user_id;

-- Recreate foreign key constraints to reference app_user_profiles
ALTER TABLE club_profiles 
  ADD CONSTRAINT club_profiles_ipp_id_fkey 
  FOREIGN KEY (ipp_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE club_profiles 
  ADD CONSTRAINT club_profiles_vpe_id_fkey 
  FOREIGN KEY (vpe_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE club_profiles 
  ADD CONSTRAINT club_profiles_vpm_id_fkey 
  FOREIGN KEY (vpm_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE club_profiles 
  ADD CONSTRAINT club_profiles_vppr_id_fkey 
  FOREIGN KEY (vppr_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE club_profiles 
  ADD CONSTRAINT club_profiles_secretary_id_fkey 
  FOREIGN KEY (secretary_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE club_profiles 
  ADD CONSTRAINT club_profiles_president_id_fkey 
  FOREIGN KEY (president_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE club_profiles 
  ADD CONSTRAINT club_profiles_treasurer_id_fkey 
  FOREIGN KEY (treasurer_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE club_profiles 
  ADD CONSTRAINT club_profiles_saa_id_fkey 
  FOREIGN KEY (saa_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE meetings 
  ADD CONSTRAINT meetings_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE poll_votes 
  ADD CONSTRAINT poll_votes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

ALTER TABLE polls 
  ADD CONSTRAINT polls_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE resources 
  ADD CONSTRAINT resources_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

ALTER TABLE role_bookings 
  ADD CONSTRAINT role_bookings_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

ALTER TABLE role_completions 
  ADD CONSTRAINT role_completions_assigned_user_id_fkey 
  FOREIGN KEY (assigned_user_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE speeches 
  ADD CONSTRAINT speeches_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

ALTER TABLE user_management_audit 
  ADD CONSTRAINT user_management_audit_performed_by_fkey 
  FOREIGN KEY (performed_by) REFERENCES app_user_profiles(id) ON DELETE SET NULL;

ALTER TABLE user_pathways 
  ADD CONSTRAINT user_pathways_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

ALTER TABLE user_performance_metrics 
  ADD CONSTRAINT fk_user_id 
  FOREIGN KEY (user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

-- Drop the sync trigger (no longer needed)
DROP TRIGGER IF EXISTS sync_user_profiles_trigger ON app_user_profiles;
DROP FUNCTION IF EXISTS sync_user_profiles();

-- Drop the user_profiles table
DROP TABLE IF EXISTS user_profiles CASCADE;
