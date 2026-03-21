/*
  # Drop All Push Notification Infrastructure

  Completely removes all push notification related database objects since
  in-app notifications will not be used.

  ## Removed Objects

  ### Triggers
  - `trigger_notify_members_new_meeting` on `app_club_meeting`
  - `trigger_notify_excomm_join_request` on `club_join_requests`
  - `trigger_notify_user_added_to_club` on `app_club_user_relationship`

  ### Functions
  - `notify_members_of_new_meeting()`
  - `notify_excomm_of_join_request()`
  - `notify_user_added_to_club()`

  ### Tables
  - `web_push_subscriptions` (full table drop)

  ### Columns
  - `push_token` column from `app_user_profiles`

  ### Indexes
  - `idx_app_user_profiles_push_token`

  ### RLS Policies
  - "Users can update own push token" on `app_user_profiles`
*/

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_notify_members_new_meeting ON app_club_meeting;
DROP TRIGGER IF EXISTS trigger_notify_excomm_join_request ON club_join_requests;
DROP TRIGGER IF EXISTS trigger_notify_user_added_to_club ON app_club_user_relationship;

-- Drop functions
DROP FUNCTION IF EXISTS notify_members_of_new_meeting();
DROP FUNCTION IF EXISTS notify_excomm_of_join_request();
DROP FUNCTION IF EXISTS notify_user_added_to_club();

-- Drop web push subscriptions table
DROP TABLE IF EXISTS web_push_subscriptions;

-- Drop push_token index
DROP INDEX IF EXISTS idx_app_user_profiles_push_token;

-- Drop push_token RLS policy
DROP POLICY IF EXISTS "Users can update own push token" ON app_user_profiles;

-- Drop push_token column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_user_profiles' AND column_name = 'push_token'
  ) THEN
    ALTER TABLE app_user_profiles DROP COLUMN push_token;
  END IF;
END $$;
