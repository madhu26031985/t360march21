/*
  # Remove Notification System

  1. Changes
    - Drop triggers for notification creation
    - Drop notification-related functions
    - Drop push_token column from app_user_profiles
    - Drop notifications table

  2. Security
    - Removes all notification-related RLS policies automatically with table drop
*/

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_notify_club_addition ON app_club_user_relationship;
DROP TRIGGER IF EXISTS trigger_notify_role_change ON app_club_user_relationship;

-- Drop functions
DROP FUNCTION IF EXISTS create_club_addition_notification();
DROP FUNCTION IF EXISTS create_role_change_notification();

-- Drop push_token column
ALTER TABLE app_user_profiles DROP COLUMN IF EXISTS push_token;

-- Drop notifications table
DROP TABLE IF EXISTS notifications CASCADE;
