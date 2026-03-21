/*
  # Migrate role_classification field to app_meeting_roles_management

  1. Schema Changes
    - Add `role_classification` column to `app_meeting_roles_management` table
    - Copy data from `app_meeting_roles` table based on role name matching
    - Add check constraint for valid role_classification values
    - Add index for performance

  2. Data Migration
    - Populate role_classification for existing records by matching role names
    - Set up trigger to automatically populate for new records

  3. Constraints and Indexes
    - Add check constraint to validate role_classification values
    - Add index for efficient querying
    - Create trigger function for automatic population
*/

-- Add role_classification column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'app_meeting_roles_management' 
    AND column_name = 'role_classification'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD COLUMN role_classification text;
  END IF;
END $$;

-- Migrate existing data from app_meeting_roles to app_meeting_roles_management
UPDATE app_meeting_roles_management 
SET role_classification = app_meeting_roles.role_classification
FROM app_meeting_roles
WHERE app_meeting_roles_management.role_name = app_meeting_roles.meeting_role_name
  AND app_meeting_roles_management.role_classification IS NULL;

-- Add check constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
    AND constraint_name = 'chk_app_meeting_roles_management_role_classification'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD CONSTRAINT chk_app_meeting_roles_management_role_classification 
    CHECK (role_classification IS NULL OR role_classification = ANY (ARRAY[
      'Key Speakers'::text, 
      'Prepared Speaker'::text, 
      'Club Speakers'::text, 
      'Educational speaker'::text, 
      'Speech evaluvator'::text, 
      'Master evaluvator'::text, 
      'TT _ Evaluvator'::text, 
      'On-the-Spot Speaking'::text, 
      'Tag roles'::text, 
      'Ancillary Speaker'::text, 
      'Judge'::text
    ]));
  END IF;
END $$;

-- Add index for role_classification if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'app_meeting_roles_management'
    AND indexname = 'idx_app_meeting_roles_management_role_classification'
  ) THEN
    CREATE INDEX idx_app_meeting_roles_management_role_classification 
    ON app_meeting_roles_management (role_classification) 
    WHERE role_classification IS NOT NULL;
  END IF;
END $$;

-- Create or replace trigger function to automatically set role_classification for new records
CREATE OR REPLACE FUNCTION set_meeting_role_management_role_classification()
RETURNS TRIGGER AS $$
BEGIN
  -- Set role_classification from app_meeting_roles based on role_name match
  IF NEW.role_classification IS NULL AND NEW.role_name IS NOT NULL THEN
    SELECT role_classification INTO NEW.role_classification
    FROM app_meeting_roles
    WHERE meeting_role_name = NEW.role_name
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_set_meeting_role_management_role_classification'
  ) THEN
    CREATE TRIGGER trigger_set_meeting_role_management_role_classification
      BEFORE INSERT OR UPDATE OF role_name ON app_meeting_roles_management
      FOR EACH ROW
      EXECUTE FUNCTION set_meeting_role_management_role_classification();
  END IF;
END $$;