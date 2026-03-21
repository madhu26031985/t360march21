/*
  # Add is_published field to Ah Counter Reports

  1. Changes
    - Add `is_published` boolean column to `ah_counter_reports` table
    - Default value is false (unpublished)
    - Add index for faster queries on published status
  
  2. Purpose
    - Allow Ah Counter to control when reports are visible to members
    - Support publish/unpublish toggle functionality
*/

-- Add is_published column to ah_counter_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ah_counter_reports' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE ah_counter_reports ADD COLUMN is_published boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Create index for faster queries on published status
CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_is_published 
  ON ah_counter_reports(is_published) WHERE is_published = true;