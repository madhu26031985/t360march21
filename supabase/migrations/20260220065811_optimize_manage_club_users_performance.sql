/*
  # Optimize Manage Club Users Performance
  
  1. Purpose
    - Speed up the manage club users page which is taking 10+ seconds to load
    - Add covering index to avoid separate table lookups
  
  2. Changes
    - Add composite index on app_club_user_relationship covering the query pattern
    - This includes club_id, is_authenticated, and created_at for sorting
    - Add index on app_user_profiles for faster profile lookups
  
  3. Performance Impact
    - Should reduce query time from 10+ seconds to under 1 second
    - The covering index allows index-only scans
*/

-- Create a covering index for the manage users query
-- This covers: WHERE club_id = X AND is_authenticated = true ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_club_user_manage_covering
ON app_club_user_relationship (club_id, is_authenticated, created_at DESC)
WHERE is_authenticated = true;

-- Add index on app_user_profiles for faster lookups during joins
CREATE INDEX IF NOT EXISTS idx_app_user_profiles_lookup
ON app_user_profiles (id, full_name, email, is_active);

-- Analyze tables to update statistics for query planner
ANALYZE app_club_user_relationship;
ANALYZE app_user_profiles;
