/*
  # Simplified RLS Policies for app_club_user_relationship

  1. Security Changes
    - Enable RLS on app_club_user_relationship table
    - Drop all existing policies to start fresh
    - Create simplified policies without complex subqueries

  2. New Policies
    - Read Access: All authenticated users can read all relationships
    - Create/Update/Delete: Users can only manage their own relationships
    - Service Role: Full access for system operations
    - ExComm Management: Moved to application level

  3. Benefits
    - Prevents complex database queries that cause loading issues
    - Simple USING (true) condition for reads
    - Direct auth.uid() comparisons for modifications
    - Better performance and reliability
*/

-- Enable RLS on the table
ALTER TABLE app_club_user_relationship ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "authenticated_users_can_read_all_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "excomm_can_manage_club_relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "service_role_full_access" ON app_club_user_relationship;
DROP POLICY IF EXISTS "users_can_manage_own_relationships" ON app_club_user_relationship;

-- 1. Read Access (SELECT): All authenticated users can read all relationships
CREATE POLICY "authenticated_users_can_read_all_relationships"
  ON app_club_user_relationship
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Create Access (INSERT): Users can only manage their own relationships
CREATE POLICY "users_can_create_own_relationships"
  ON app_club_user_relationship
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Update Access (UPDATE): Users can only manage their own relationships
CREATE POLICY "users_can_update_own_relationships"
  ON app_club_user_relationship
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Delete Access (DELETE): Users can only manage their own relationships
CREATE POLICY "users_can_delete_own_relationships"
  ON app_club_user_relationship
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 5. Service Role: Full access for system operations
CREATE POLICY "service_role_full_access"
  ON app_club_user_relationship
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);