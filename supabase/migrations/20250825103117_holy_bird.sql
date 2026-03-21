/*
  # Fix Clubs Table RLS Policy

  1. Security Changes
    - Add INSERT policy for authenticated users to create clubs
    - Ensure authenticated users can create new clubs
    - Maintain existing SELECT and UPDATE policies

  2. Changes Made
    - Add "authenticated_users_can_create_clubs" policy for INSERT operations
    - Allow any authenticated user to create a club
    - Keep existing policies intact
*/

-- Add INSERT policy for authenticated users to create clubs
DO $$
BEGIN
  -- Check if the INSERT policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clubs' 
    AND policyname = 'authenticated_users_can_create_clubs'
  ) THEN
    CREATE POLICY "authenticated_users_can_create_clubs"
      ON clubs
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Ensure RLS is enabled on clubs table
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;