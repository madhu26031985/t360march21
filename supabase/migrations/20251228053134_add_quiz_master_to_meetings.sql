/*
  # Add Quiz Master to meetings

  1. Changes
    - Add `quiz_master_id` column to `app_club_meeting` table
    - Allows assignment of a Quiz Master for meetings
  
  2. Security
    - No RLS changes needed (existing policies handle access)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_club_meeting' AND column_name = 'quiz_master_id'
  ) THEN
    ALTER TABLE app_club_meeting ADD COLUMN quiz_master_id uuid REFERENCES app_user_profiles(id);
  END IF;
END $$;