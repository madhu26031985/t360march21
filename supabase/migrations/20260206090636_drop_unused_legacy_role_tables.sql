/*
  # Drop Unused Legacy Role Tables

  1. Tables and Views to Remove
    - `meeting_role_details` (view) - No data, not used in application
    - `meeting_roles` (table) - No data, not used in application
    - `role_types` (table) - No data, not used in application
    - `role_bookings` (table) - No data, not used in application

  2. Impact
    - Removes legacy tables from old system architecture
    - No data loss (all tables are empty)
    - No impact on current functionality (app uses app_meeting_roles and app_meeting_roles_management)
    - Cleans up database schema

  3. Current System
    - The active system uses:
      - `app_meeting_roles` (master roles table with 46 roles)
      - `app_meeting_roles_management` (meeting-specific role assignments)
*/

-- Drop the view first (depends on the tables)
DROP VIEW IF EXISTS meeting_role_details CASCADE;

-- Drop the tables (CASCADE will drop any remaining dependencies)
DROP TABLE IF EXISTS meeting_roles CASCADE;
DROP TABLE IF EXISTS role_bookings CASCADE;
DROP TABLE IF EXISTS role_types CASCADE;
