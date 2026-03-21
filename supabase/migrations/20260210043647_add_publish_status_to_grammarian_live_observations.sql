/*
  # Add Publishing Status to Grammarian Live Observations

  ## Summary
  Adds is_published field to live good usage and improvements tables
  to control visibility in the consolidated report. Similar to word/idiom/quote publishing.

  ## Changes
  1. Add `is_published` column to `grammarian_live_good_usage`
     - Boolean field with default false
     - Controls whether observation appears in consolidated report

  2. Add `is_published` column to `grammarian_live_improvements`
     - Boolean field with default false
     - Controls whether improvement appears in consolidated report

  ## Notes
  - Grammarian can prepare observations privately before publishing
  - Once published, observations appear in the meeting's grammarian summary
  - Follows same pattern as word/idiom/quote of the day publishing
*/

-- Add is_published to grammarian_live_good_usage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammarian_live_good_usage' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE grammarian_live_good_usage ADD COLUMN is_published boolean DEFAULT false;
  END IF;
END $$;

-- Add is_published to grammarian_live_improvements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammarian_live_improvements' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE grammarian_live_improvements ADD COLUMN is_published boolean DEFAULT false;
  END IF;
END $$;

-- Add indexes for published status (for efficient filtering)
CREATE INDEX IF NOT EXISTS idx_live_good_usage_published ON grammarian_live_good_usage(is_published);
CREATE INDEX IF NOT EXISTS idx_live_improvements_published ON grammarian_live_improvements(is_published);

-- Add comments
COMMENT ON COLUMN grammarian_live_good_usage.is_published IS 'Whether the observation is published and visible in consolidated report';
COMMENT ON COLUMN grammarian_live_improvements.is_published IS 'Whether the improvement is published and visible in consolidated report';
