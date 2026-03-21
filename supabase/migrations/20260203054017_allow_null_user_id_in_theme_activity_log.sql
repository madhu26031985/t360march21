/*
  # Allow Null User ID in Theme Activity Log

  1. Changes
    - Make `user_id` nullable in `toastmaster_theme_activity_log`
    - This prevents errors when auth.uid() returns null

  2. Security
    - No changes to RLS policies
*/

-- Make user_id nullable
ALTER TABLE toastmaster_theme_activity_log 
  ALTER COLUMN user_id DROP NOT NULL;

-- Update foreign key constraint to allow NULL
ALTER TABLE toastmaster_theme_activity_log 
  DROP CONSTRAINT IF EXISTS toastmaster_theme_activity_log_user_id_fkey;

ALTER TABLE toastmaster_theme_activity_log 
  ADD CONSTRAINT toastmaster_theme_activity_log_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES app_user_profiles(id) 
  ON DELETE SET NULL;