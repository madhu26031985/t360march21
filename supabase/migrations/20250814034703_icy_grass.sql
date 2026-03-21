/*
  # Drop unused club_join_requests table

  1. Table Removal
    - Drop `club_join_requests` table completely
    - This table was used for club join request functionality that has been removed
    - All related indexes, constraints, and policies will be automatically dropped

  2. Impact
    - Removes unused table and all its data
    - Cleans up database schema
    - No impact on current functionality as this feature was already removed from the app
*/

-- Drop the club_join_requests table
DROP TABLE IF EXISTS club_join_requests CASCADE;