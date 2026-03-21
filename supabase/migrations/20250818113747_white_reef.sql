/*
  # Add role_status column to app_meeting_roles_management

  1. New Column
    - `role_status` (text) - Controls role availability: 'Available' or 'Deleted'
    - Default value: 'Available'
    - Check constraint to ensure valid values

  2. Database Changes
    - Add column with default value
    - Add check constraint for valid statuses
    - Add index for better performance
    - Update existing records to 'Available'

  3. Functionality
    - Only roles with 'Available' status show in book-a-role
    - Admins can mark roles as 'Deleted' to hide them
    - All roles default to 'Available' when meeting is created
*/

-- Add role_status column to app_meeting_roles_management
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_meeting_roles_management' 
    AND column_name = 'role_status'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD COLUMN role_status text DEFAULT 'Available';
  END IF;
END $$;

-- Add check constraint for valid role_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_role_status_valid'
  ) THEN
    ALTER TABLE app_meeting_roles_management
    ADD CONSTRAINT chk_role_status_valid 
    CHECK (role_status IN ('Available', 'Deleted'));
  END IF;
END $$;

-- Add index for role_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_app_meeting_roles_management_role_status'
  ) THEN
    CREATE INDEX idx_app_meeting_roles_management_role_status 
    ON app_meeting_roles_management (role_status);
  END IF;
END $$;

-- Update all existing records to have 'Available' status
UPDATE app_meeting_roles_management 
SET role_status = 'Available' 
WHERE role_status IS NULL;