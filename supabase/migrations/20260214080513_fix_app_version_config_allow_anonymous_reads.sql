/*
  # Fix App Version Config RLS Policy

  1. Changes
    - Drop the existing restrictive policy that only allows authenticated users
    - Create new policy that allows both authenticated and anonymous users to read version config
    - This ensures version checks work even before user login

  2. Security
    - Anonymous users can only READ version config (safe, public information)
    - Write/update operations remain blocked for all users (system-managed only)
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Anyone can read version config" ON app_version_config;

-- Create new policy that allows anonymous and authenticated users to read
CREATE POLICY "Anyone can read version config"
  ON app_version_config
  FOR SELECT
  USING (true);
