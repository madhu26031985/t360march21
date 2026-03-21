/*
  # Migrate Bio Data from user_profiles to app_user_profiles

  1. Data Migration
    - Copy `bio` field from `user_profiles` table to `About` field in `app_user_profiles` table
    - Only update records where both user profiles exist and are active
    - Preserve existing data in `app_user_profiles` if already present

  2. Safety Features
    - Non-destructive operation using COALESCE to preserve existing data
    - Only processes active users
    - Updates timestamp to track when migration occurred
*/

-- Migrate bio data from user_profiles to app_user_profiles
UPDATE app_user_profiles 
SET 
  "About" = COALESCE(app_user_profiles."About", user_profiles.bio),
  updated_at = CASE 
    WHEN app_user_profiles."About" IS NULL AND user_profiles.bio IS NOT NULL 
    THEN now() 
    ELSE app_user_profiles.updated_at 
  END
FROM user_profiles 
WHERE app_user_profiles.id = user_profiles.id 
  AND user_profiles.is_active = true 
  AND user_profiles.bio IS NOT NULL 
  AND TRIM(user_profiles.bio) != '';

-- Log the migration results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Bio migration completed. Updated % user profiles with bio data.', updated_count;
END $$;