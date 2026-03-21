/*
  # Add is_unavailable flag to ah_counter_tracked_members

  ## Changes
  - Adds `is_unavailable` boolean column (default false) to `ah_counter_tracked_members`
  - Allows the Ah Counter to mark members as not available for a meeting
  - Members with is_unavailable = true will appear in the "Not Available" section

  ## Notes
  - Default is false (attending)
  - No data loss: existing rows simply get false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ah_counter_tracked_members' AND column_name = 'is_unavailable'
  ) THEN
    ALTER TABLE ah_counter_tracked_members ADD COLUMN is_unavailable boolean NOT NULL DEFAULT false;
  END IF;
END $$;
