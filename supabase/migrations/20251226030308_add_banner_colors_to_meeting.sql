/*
  # Add Banner Colors to Meeting Table

  1. Changes
    - Add `club_info_banner_color` column to `app_club_meeting` table
      - Stores hex color code for the club information banner (default: #3b82f6 - blue)
    - Add `datetime_banner_color` column to `app_club_meeting` table
      - Stores hex color code for the date/time banner (default: #f97316 - orange)
  
  2. Notes
    - Default colors match the existing hardcoded values
    - Colors stored as text in hex format (e.g., '#3b82f6')
    - Excomm can customize these colors through the agenda editor
*/

ALTER TABLE app_club_meeting 
ADD COLUMN IF NOT EXISTS club_info_banner_color text DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS datetime_banner_color text DEFAULT '#f97316';