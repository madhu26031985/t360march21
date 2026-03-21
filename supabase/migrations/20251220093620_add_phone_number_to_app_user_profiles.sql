/*
  # Add phone_number column to app_user_profiles

  1. Changes
    - Add `phone_number` column to `app_user_profiles` table
      - Type: text (nullable)
      - Allows users to optionally provide their phone number for contact purposes
  
  2. Notes
    - Phone number is optional (nullable) as not all users may want to share this information
    - No validation is applied at database level to allow flexibility in phone number formats
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_user_profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE app_user_profiles ADD COLUMN phone_number text;
  END IF;
END $$;
