/*
  # Add Footer Banner Colors to Meetings

  1. Changes
    - Add `footer_banner_1_color` column to store first footer banner color
    - Add `footer_banner_2_color` column to store second footer banner color
    
  2. Details
    - Both columns are text type to store hex color codes
    - Default values provided for consistency
    - Footer banners will appear at the bottom of meeting agendas
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_club_meeting' AND column_name = 'footer_banner_1_color'
  ) THEN
    ALTER TABLE app_club_meeting ADD COLUMN footer_banner_1_color text DEFAULT '#16a34a';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_club_meeting' AND column_name = 'footer_banner_2_color'
  ) THEN
    ALTER TABLE app_club_meeting ADD COLUMN footer_banner_2_color text DEFAULT '#ea580c';
  END IF;
END $$;