/*
  # Add club_id to app_meeting_roles_management table

  1. Schema Changes
    - Add `club_id` column to `app_meeting_roles_management` table
    - Add foreign key constraint to reference `clubs` table
    - Add index for better query performance
    - Populate existing records with club_id from related meeting

  2. Data Migration
    - Update existing records to include club_id from the meeting's club_id
    - Ensure data consistency across all existing records

  3. Constraints
    - Add NOT NULL constraint after data migration
    - Add foreign key relationship to clubs table
    - Add index for efficient querying
*/

-- Add club_id column (nullable initially for data migration)
ALTER TABLE app_meeting_roles_management 
ADD COLUMN IF NOT EXISTS club_id uuid;

-- Populate existing records with club_id from related meetings
UPDATE app_meeting_roles_management 
SET club_id = (
  SELECT club_id 
  FROM app_club_meeting 
  WHERE app_club_meeting.id = app_meeting_roles_management.meeting_id
)
WHERE club_id IS NULL;

-- Make club_id NOT NULL after data migration
ALTER TABLE app_meeting_roles_management 
ALTER COLUMN club_id SET NOT NULL;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_meeting_roles_management_club_id'
    AND table_name = 'app_meeting_roles_management'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD CONSTRAINT fk_meeting_roles_management_club_id 
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_management_club_id 
ON app_meeting_roles_management(club_id);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_management_club_meeting 
ON app_meeting_roles_management(club_id, meeting_id);

-- Update the trigger function to automatically set club_id for new records
CREATE OR REPLACE FUNCTION set_meeting_role_management_club_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically set club_id from the related meeting
  IF NEW.club_id IS NULL AND NEW.meeting_id IS NOT NULL THEN
    SELECT club_id INTO NEW.club_id
    FROM app_club_meeting
    WHERE id = NEW.meeting_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set club_id for new records
DROP TRIGGER IF EXISTS trigger_set_meeting_role_management_club_id ON app_meeting_roles_management;
CREATE TRIGGER trigger_set_meeting_role_management_club_id
  BEFORE INSERT OR UPDATE OF meeting_id ON app_meeting_roles_management
  FOR EACH ROW
  EXECUTE FUNCTION set_meeting_role_management_club_id();