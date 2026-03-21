/*
  # Add agenda visibility control for meetings

  1. Changes
    - Add `is_agenda_visible` boolean column to `app_club_meeting` table
    - Defaults to `true` (visible)
    - Allows excomm to control when agenda is shown to members
  
  2. Security
    - No RLS changes needed (existing policies handle access)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_club_meeting' AND column_name = 'is_agenda_visible'
  ) THEN
    ALTER TABLE app_club_meeting ADD COLUMN is_agenda_visible boolean DEFAULT true;
  END IF;
END $$;