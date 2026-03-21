/*
  # Add Allow Join Requests Control to Clubs

  1. Changes
    - Add `allow_join_requests` boolean column to clubs table
    - Default to false (clubs must explicitly enable this feature)
    - This allows ExComm to control whether their club appears in public join requests
    
  2. Security
    - Column is readable by all authenticated users
    - Only ExComm members can update this setting (existing RLS policies handle this)
*/

-- Add column to clubs table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'allow_join_requests'
  ) THEN
    ALTER TABLE clubs ADD COLUMN allow_join_requests boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN clubs.allow_join_requests IS 'Controls whether the club appears in public join request lists. Only ExComm can toggle this.';
