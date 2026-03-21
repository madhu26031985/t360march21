/*
  # Add Role Name Index for Fast Exact Matches

  1. New Index
    - Index on role_name for exact match queries
    - This optimizes queries like WHERE role_name = 'Timer'

  2. Purpose
    - Speeds up exact role name lookups
    - Complements the existing composite indexes
    - Reduces query time for Timer role lookups
*/

-- Add index for role_name to optimize exact matches
CREATE INDEX IF NOT EXISTS idx_meeting_roles_role_name 
ON app_meeting_roles_management (role_name);

-- Add composite index for role_name + meeting_id for even faster queries
CREATE INDEX IF NOT EXISTS idx_meeting_roles_name_meeting
ON app_meeting_roles_management (role_name, meeting_id, booking_status)
WHERE booking_status = 'booked';