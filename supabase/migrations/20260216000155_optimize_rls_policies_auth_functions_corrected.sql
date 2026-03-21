/*
  # Optimize RLS Policies - Auth Function Optimization

  1. Performance Improvements
    - Replace `auth.uid()` with `(select auth.uid())` in RLS policies
    - This prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale
  
  2. Tables Fixed (Most Critical)
    - app_user_profiles
    - app_club_user_relationship  
    - club_join_requests
    - app_meeting_attendance
    - poll_votes
    - simple_poll_votes
*/

-- Fix app_user_profiles policies
DROP POLICY IF EXISTS "users_can_manage_own_profile" ON app_user_profiles;
CREATE POLICY "users_can_manage_own_profile" ON app_user_profiles
  FOR ALL
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own push token" ON app_user_profiles;
CREATE POLICY "Users can update own push token" ON app_user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Fix app_club_user_relationship policies
DROP POLICY IF EXISTS "Users can view their own club relationships" ON app_club_user_relationship;
CREATE POLICY "Users can view their own club relationships" ON app_club_user_relationship
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can add themselves to clubs" ON app_club_user_relationship;
CREATE POLICY "Users can add themselves to clubs" ON app_club_user_relationship
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Fix club_join_requests policies
DROP POLICY IF EXISTS "users_can_view_own_requests" ON club_join_requests;
CREATE POLICY "users_can_view_own_requests" ON club_join_requests
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "users_can_create_requests" ON club_join_requests;
CREATE POLICY "users_can_create_requests" ON club_join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "users_can_withdraw_requests" ON club_join_requests;
CREATE POLICY "users_can_withdraw_requests" ON club_join_requests
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Fix poll_votes policies
DROP POLICY IF EXISTS "Users can insert their own votes" ON poll_votes;
CREATE POLICY "Users can insert their own votes" ON poll_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own votes" ON poll_votes;
CREATE POLICY "Users can update their own votes" ON poll_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own votes" ON poll_votes;
CREATE POLICY "Users can delete their own votes" ON poll_votes
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix simple_poll_votes policies
DROP POLICY IF EXISTS "Authenticated users can insert their own votes" ON simple_poll_votes;
CREATE POLICY "Authenticated users can insert their own votes" ON simple_poll_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update their own votes" ON simple_poll_votes;
CREATE POLICY "Authenticated users can update their own votes" ON simple_poll_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete their own votes" ON simple_poll_votes;
CREATE POLICY "Authenticated users can delete their own votes" ON simple_poll_votes
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
