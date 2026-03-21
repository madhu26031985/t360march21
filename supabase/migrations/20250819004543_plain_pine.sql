/*
  # Add Role Completion Tracking

  1. New Columns
    - `is_completed` (boolean) - Whether the role was successfully completed
    - `completed_at` (timestamp) - When the role was marked as completed
    - `completion_notes` (text) - Optional notes about the completion

  2. Updates
    - Add columns to `app_meeting_roles_management` table
    - Set default values for existing records
    - Add indexes for performance

  3. Security
    - No RLS changes needed (inherits from table)
*/

-- Add role completion tracking columns to app_meeting_roles_management
DO $$
BEGIN
  -- Add is_completed column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_meeting_roles_management' AND column_name = 'is_completed'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD COLUMN is_completed boolean DEFAULT false NOT NULL;
  END IF;

  -- Add completed_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_meeting_roles_management' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD COLUMN completed_at timestamptz DEFAULT NULL;
  END IF;

  -- Add completion_notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_meeting_roles_management' AND column_name = 'completion_notes'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD COLUMN completion_notes text DEFAULT NULL;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_management_is_completed 
ON app_meeting_roles_management (is_completed);

CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_management_completed_at 
ON app_meeting_roles_management (completed_at) 
WHERE completed_at IS NOT NULL;

-- Add check constraint to ensure completed_at is set when is_completed is true
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'chk_completion_consistency'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD CONSTRAINT chk_completion_consistency 
    CHECK (
      (is_completed = false) OR 
      (is_completed = true AND completed_at IS NOT NULL)
    );
  END IF;
END $$;