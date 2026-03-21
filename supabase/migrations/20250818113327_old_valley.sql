/*
  # Remove status column from app_meeting_roles_management

  1. Changes
    - Remove `status` column from `app_meeting_roles_management` table
    - Remove related indexes and constraints
    - Clean up any references to the status column

  2. Impact
    - Simplifies the table structure
    - Removes status-based filtering logic
    - All roles will be treated as active/available
*/

-- Remove the status column from app_meeting_roles_management
DO $$
BEGIN
  -- Drop any indexes that reference the status column
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'app_meeting_roles_management' 
    AND indexname = 'idx_app_meeting_roles_management_status'
  ) THEN
    DROP INDEX idx_app_meeting_roles_management_status;
  END IF;

  -- Remove the status column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_meeting_roles_management' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE app_meeting_roles_management DROP COLUMN status;
  END IF;

  -- Remove any check constraints related to status
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_meeting_roles_management_status'
  ) THEN
    ALTER TABLE app_meeting_roles_management DROP CONSTRAINT chk_meeting_roles_management_status;
  END IF;
END $$;