/*
  # Remove Recursive SELECT Policy from app_club_user_relationship

  ## Problem
  The "Club members can view relationships within their club" policy causes infinite recursion:
  
  1. User inserts themselves into app_club_user_relationship (club creation)
  2. Supabase tries to SELECT the inserted row (because of .select() call)
  3. SELECT policy checks: "Is this user a member of this club?"
  4. That check queries app_club_user_relationship (same table!)
  5. Which triggers another SELECT policy check → infinite recursion

  ## Solution
  Remove the recursive SELECT policy. Users can still view their own relationships,
  which is sufficient for club creation and most operations.

  For viewing other members in a club, we'll rely on the application layer
  or create a view that doesn't cause recursion.

  ## Policies After This Migration
  - SELECT: Users can view their own club relationships (no recursion)
  - INSERT: Users can add themselves to clubs
  - INSERT: ExComm can add other users to their club
  - UPDATE: ExComm can update users in their club
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Club members can view relationships within their club" 
  ON app_club_user_relationship;

-- Note: "Users can view their own club relationships" remains active
-- This is sufficient for club creation and doesn't cause recursion
