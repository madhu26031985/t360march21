/*
  # Update RLS policies for app_club_user_relationship table

  1. Security Updates
    - Enable RLS on app_club_user_relationship table
    - Drop existing policies to avoid conflicts
    - Create new policies with proper auth.uid() function

  2. New Policies
    - Users can read all club relationships (for member lists)
    - Users can create their own relationships (for joining clubs)
    - Users can update their own relationships (for managing status)
    - Users can delete their own relationships (for leaving clubs)
    - ExComm members can manage all relationships in their clubs
    - Service role has full access for system operations

  3. Policy Details
    - Uses auth.uid() instead of uid() for proper authentication
    - Allows self-management of relationships
    - Enables club administration by ExComm members
    - Maintains data security and access control
*/

-- Enable RLS on the table
ALTER TABLE app_club_user_relationship ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can read club relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "ExComm members can manage all club relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "Service role has full access" ON app_club_user_relationship;
DROP POLICY IF EXISTS "Service role has full access to relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "Users can insert their own relationships" ON app_club_user_relationship;
DROP POLICY IF EXISTS "Users can update their own relationships" ON app_club_user_relationship;

-- Policy 1: All authenticated users can read all club relationships
-- This allows users to see member lists and club information
CREATE POLICY "Users can read all club relationships"
  ON app_club_user_relationship
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Users can create their own relationships
-- This allows users to join clubs or request membership
CREATE POLICY "Users can create their own relationships"
  ON app_club_user_relationship
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy 3: Users can update their own relationships
-- This allows users to modify their own club status
CREATE POLICY "Users can update their own relationships"
  ON app_club_user_relationship
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy 4: Users can delete their own relationships
-- This allows users to leave clubs
CREATE POLICY "Users can delete their own relationships"
  ON app_club_user_relationship
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 5: ExComm members can manage all relationships in their clubs
-- This allows club administrators to add/remove members and change roles
CREATE POLICY "ExComm can manage club relationships"
  ON app_club_user_relationship
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM app_club_user_relationship acur
      WHERE acur.user_id = auth.uid()
        AND acur.club_id = app_club_user_relationship.club_id
        AND acur.role = 'excomm'
        AND acur.is_authenticated = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM app_club_user_relationship acur
      WHERE acur.user_id = auth.uid()
        AND acur.club_id = app_club_user_relationship.club_id
        AND acur.role = 'excomm'
        AND acur.is_authenticated = true
    )
  );

-- Policy 6: Service role has full access for system operations
CREATE POLICY "Service role has full access to relationships"
  ON app_club_user_relationship
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);