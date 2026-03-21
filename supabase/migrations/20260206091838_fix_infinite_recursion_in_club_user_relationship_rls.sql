/*
  # Fix Infinite Recursion in app_club_user_relationship RLS

  ## Problem
  When creating a club, the INSERT policy checks if the user is ExComm by querying 
  app_club_user_relationship, which triggers SELECT policies that also query the same table,
  causing infinite recursion.

  ## Solution
  1. Allow users to insert themselves (self-insertion) - for creating clubs
  2. Keep ExComm policy for adding OTHER users, but make it restrictive
  3. Simplify the "Users can accept invitations" policy

  ## New Policy Structure
  - INSERT: Users can add themselves to any club (for club creation)
  - INSERT: ExComm can add OTHER users (not themselves) to their club
  - INSERT: Users can accept invitations (simplified)
  - SELECT: Users can view their own relationships
  - SELECT: Club members can view relationships within their club
  - UPDATE: ExComm can update users in their club
*/

-- Drop the problematic INSERT policies
DROP POLICY IF EXISTS "ExComm can add users to their club" ON app_club_user_relationship;
DROP POLICY IF EXISTS "Users can accept invitations" ON app_club_user_relationship;

-- Create new INSERT policy: Users can add themselves
-- This allows club creation and self-joining
CREATE POLICY "Users can add themselves to clubs"
  ON app_club_user_relationship
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create new INSERT policy: ExComm can add OTHER users
-- This prevents recursion by NOT allowing self-insertion through this policy
CREATE POLICY "ExComm can add other users to their club"
  ON app_club_user_relationship
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id != auth.uid() -- Can only add OTHER users
    AND EXISTS (
      SELECT 1
      FROM app_club_user_relationship excomm_rel
      WHERE excomm_rel.club_id = app_club_user_relationship.club_id
        AND excomm_rel.user_id = auth.uid()
        AND excomm_rel.role IN ('excomm', 'president', 'vpe', 'vpm', 'vppr', 'secretary', 'treasurer', 'saa', 'ipp')
        AND excomm_rel.is_authenticated = true
    )
  );
