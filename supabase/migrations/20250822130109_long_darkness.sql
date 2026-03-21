/*
  # Add Professional Information Columns

  1. New Columns
    - `location` (text) - User's location/city
    - `occupation` (text) - User's job title or profession  
    - `interests` (text) - User's interests and hobbies
    - `achievements` (text) - User's achievements and accomplishments

  2. Changes
    - Add professional information columns to app_user_profiles table
    - Add length constraints for data validation
    - Update existing triggers to handle new columns

  3. Security
    - Existing RLS policies will automatically apply to new columns
*/

-- Add professional information columns to app_user_profiles table
DO $$
BEGIN
  -- Add location column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_user_profiles' AND column_name = 'location'
  ) THEN
    ALTER TABLE app_user_profiles ADD COLUMN location text;
  END IF;

  -- Add occupation column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_user_profiles' AND column_name = 'occupation'
  ) THEN
    ALTER TABLE app_user_profiles ADD COLUMN occupation text;
  END IF;

  -- Add interests column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_user_profiles' AND column_name = 'interests'
  ) THEN
    ALTER TABLE app_user_profiles ADD COLUMN interests text;
  END IF;

  -- Add achievements column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_user_profiles' AND column_name = 'achievements'
  ) THEN
    ALTER TABLE app_user_profiles ADD COLUMN achievements text;
  END IF;
END $$;

-- Add length constraints for the new columns
DO $$
BEGIN
  -- Location constraint (max 100 characters)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_app_user_profiles_location_length'
  ) THEN
    ALTER TABLE app_user_profiles 
    ADD CONSTRAINT chk_app_user_profiles_location_length 
    CHECK (location IS NULL OR length(location) <= 100);
  END IF;

  -- Occupation constraint (max 100 characters)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_app_user_profiles_occupation_length'
  ) THEN
    ALTER TABLE app_user_profiles 
    ADD CONSTRAINT chk_app_user_profiles_occupation_length 
    CHECK (occupation IS NULL OR length(occupation) <= 100);
  END IF;

  -- Interests constraint (max 300 characters)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_app_user_profiles_interests_length'
  ) THEN
    ALTER TABLE app_user_profiles 
    ADD CONSTRAINT chk_app_user_profiles_interests_length 
    CHECK (interests IS NULL OR length(interests) <= 300);
  END IF;

  -- Achievements constraint (max 500 characters)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_app_user_profiles_achievements_length'
  ) THEN
    ALTER TABLE app_user_profiles 
    ADD CONSTRAINT chk_app_user_profiles_achievements_length 
    CHECK (achievements IS NULL OR length(achievements) <= 500);
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_app_user_profiles_location 
ON app_user_profiles (location) 
WHERE location IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_user_profiles_occupation 
ON app_user_profiles (occupation) 
WHERE occupation IS NOT NULL;