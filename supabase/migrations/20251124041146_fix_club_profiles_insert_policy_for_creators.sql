/*
  # Fix club_profiles RLS policy for club creators

  1. Problem
     - When a user creates a new club, triggers automatically create a club_profiles entry
     - The RLS policy blocks the insert because the user is not yet an ExComm member
     - This creates a chicken-and-egg problem

  2. Solution
     - Add a new RLS policy that allows club creators to insert club_profiles
     - Check if the user is the creator of the club (created_by field in clubs table)
     - This allows the trigger to succeed during club creation

  3. Security
     - Only authenticated users can insert
     - User must be the creator of the club (created_by = auth.uid())
     - Existing ExComm policy remains for ongoing management
*/

-- Add policy to allow club creators to insert club_profiles during creation
CREATE POLICY "club_creators_can_insert_club_profile"
  ON club_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM clubs
      WHERE clubs.id = club_profiles.club_id
        AND clubs.created_by = auth.uid()
    )
  );
