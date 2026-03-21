/*
  # Add avatar_url column to app_user_profiles

  1. Schema Changes
    - Add `avatar_url` column to `app_user_profiles` table
    - Column stores URL to user's profile picture
    - Nullable field (users can have no profile picture)
    - Text type to store image URLs or base64 data

  2. Safety
    - Uses IF NOT EXISTS to prevent errors on re-run
    - Non-breaking change - existing users unaffected
*/

-- Add avatar_url column to app_user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_user_profiles' 
    AND column_name = 'avatar_url'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE app_user_profiles 
    ADD COLUMN avatar_url text;
    
    -- Add comment for documentation
    COMMENT ON COLUMN app_user_profiles.avatar_url IS 'URL or base64 data for user profile picture';
  END IF;
END $$;