/*
  # Update Default Banner Colors for Meeting Agendas

  1. Changes
    - Update default color for `club_info_banner_color` to #772432 (maroon)
    - Update default color for `datetime_banner_color` to #000000 (black)
    - Update default color for `footer_banner_1_color` to #772432 (maroon)
    - Update default color for `footer_banner_2_color` to #000000 (black)
  
  2. Details
    - Changes the default values for all banner color columns
    - New meetings will automatically use these colors
    - Existing meetings retain their current colors
*/

-- Update club_info_banner_color default
ALTER TABLE app_club_meeting 
ALTER COLUMN club_info_banner_color SET DEFAULT '#772432';

-- Update datetime_banner_color default
ALTER TABLE app_club_meeting 
ALTER COLUMN datetime_banner_color SET DEFAULT '#000000';

-- Update footer_banner_1_color default
ALTER TABLE app_club_meeting 
ALTER COLUMN footer_banner_1_color SET DEFAULT '#772432';

-- Update footer_banner_2_color default
ALTER TABLE app_club_meeting 
ALTER COLUMN footer_banner_2_color SET DEFAULT '#000000';
