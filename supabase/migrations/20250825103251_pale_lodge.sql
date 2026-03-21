/*
  # Add Active Column to Clubs Table

  1. New Column
    - `active` (boolean, default true)
      - Controls whether a club is active or soft-deleted
      - Default true for backward compatibility
      - NOT NULL constraint for data integrity

  2. Data Migration
    - Set all existing clubs to active = true
    - Ensures no disruption to current clubs

  3. Performance
    - Add index on active column for efficient queries
    - Partial index only on active clubs

  4. Security
    - Update RLS policies to consider active status
    - Ensure soft-deleted clubs are properly handled
*/

-- Add the active column to clubs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'active'
  ) THEN
    ALTER TABLE clubs ADD COLUMN active boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Set all existing clubs to active
UPDATE clubs SET active = true WHERE active IS NULL;

-- Add index for performance on active clubs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'clubs' AND indexname = 'idx_clubs_active'
  ) THEN
    CREATE INDEX idx_clubs_active ON clubs (active) WHERE active = true;
  END IF;
END $$;

-- Add constraint to ensure active is never null
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_clubs_active_not_null'
  ) THEN
    ALTER TABLE clubs ADD CONSTRAINT chk_clubs_active_not_null CHECK (active IS NOT NULL);
  END IF;
END $$;

-- Update RLS policies to handle active status
DO $$
BEGIN
  -- Drop existing policies if they exist to recreate them with active filter
  DROP POLICY IF EXISTS "Allow users to view active clubs" ON clubs;
  
  -- Create policy to only show active clubs
  CREATE POLICY "Allow users to view active clubs" 
    ON clubs 
    FOR SELECT 
    TO authenticated 
    USING (active = true);
END $$;