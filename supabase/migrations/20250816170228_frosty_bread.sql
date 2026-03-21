/*
  # Add banner_color column to club_profiles table

  1. New Columns
    - `banner_color` (text, nullable) - Stores approved Toastmasters banner colors

  2. Changes
    - Add banner_color column to club_profiles table
    - Column allows NULL values for clubs that haven't selected a color yet
    - No constraints needed as this is for visual customization only

  3. Notes
    - This column will store hex color values like #772432 or #004165
    - Used for customizing club webpage banner/hero section colors
    - Only approved Toastmasters colors should be stored
*/

-- Add banner_color column to club_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'banner_color'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN banner_color text;
  END IF;
END $$;

-- Add comment to the column
COMMENT ON COLUMN club_profiles.banner_color IS 'Approved Toastmasters banner color for club webpage (hex format)';