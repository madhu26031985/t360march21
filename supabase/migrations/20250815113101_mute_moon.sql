/*
  # Add meeting_status column to app_club_meeting table

  1. Schema Changes
    - Add `meeting_status` column to `app_club_meeting` table
    - Column type: text with default value 'open'
    - Valid values: 'open', 'close'

  2. Constraints
    - Add check constraint to validate meeting status values
    - Ensure only 'open' or 'close' values are allowed

  3. Indexes
    - Add index on meeting_status for efficient filtering
*/

-- Add meeting_status column with default value 'open'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_club_meeting' AND column_name = 'meeting_status'
  ) THEN
    ALTER TABLE app_club_meeting ADD COLUMN meeting_status text DEFAULT 'open';
  END IF;
END $$;

-- Add constraint to validate meeting status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_app_club_meeting_valid_status'
  ) THEN
    ALTER TABLE app_club_meeting 
    ADD CONSTRAINT chk_app_club_meeting_valid_status 
    CHECK (meeting_status IN ('open', 'close'));
  END IF;
END $$;

-- Create index on meeting_status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_app_club_meeting_status 
  ON app_club_meeting (meeting_status);

-- Update RLS policies to include meeting_status in queries
-- (Existing policies will automatically include the new column)