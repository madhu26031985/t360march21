/*
  # Remove Phone Number from User Profiles

  1. Changes
    - Drop `phone_number` column from `app_user_profiles` table
  
  2. Notes
    - Phone number is no longer collected during signup
    - This change is safe as phone_number was already nullable
    - No data migration needed as we're removing an optional field
*/

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_user_profiles' 
    AND column_name = 'phone_number'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE app_user_profiles DROP COLUMN phone_number;
  END IF;
END $$;
