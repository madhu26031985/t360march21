/*
  # Add YouTube URL to User Profiles

  1. Changes
    - Add `youtube_url` column to `app_user_profiles` table
    - Column is optional (nullable) to allow users to optionally add their YouTube channel
    - Character limit of 200 characters (consistent with other social media URLs)

  2. Notes
    - No RLS policy changes needed as existing policies cover all columns
*/

-- Add youtube_url column to app_user_profiles
ALTER TABLE app_user_profiles 
ADD COLUMN IF NOT EXISTS youtube_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN app_user_profiles.youtube_url IS 'User YouTube channel or profile URL';