/*
  # Update Role Booking Status System

  1. Database Changes
    - Add booking_status column to app_meeting_roles_management
    - Add booked_at and withdrawn_at timestamp columns
    - Update existing records to have proper status values
    - Add constraints for valid status values

  2. Status Flow
    - open: Role is available for booking
    - booked: Role is assigned to a member
    - withdrawn: Member withdrew, role available for rebooking

  3. Triggers
    - Automatically set booking_status based on assigned_user_id
    - Set timestamps when status changes
*/

-- Add booking_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_meeting_roles_management' 
    AND column_name = 'booking_status'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD COLUMN booking_status text DEFAULT 'open';
  END IF;
END $$;

-- Add timestamp columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_meeting_roles_management' 
    AND column_name = 'booked_at'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD COLUMN booked_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_meeting_roles_management' 
    AND column_name = 'withdrawn_at'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD COLUMN withdrawn_at timestamptz;
  END IF;
END $$;

-- Add constraint for valid booking status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_booking_status_valid'
  ) THEN
    ALTER TABLE app_meeting_roles_management 
    ADD CONSTRAINT chk_booking_status_valid 
    CHECK (booking_status IN ('open', 'booked', 'withdrawn'));
  END IF;
END $$;

-- Update existing records to have proper status
UPDATE app_meeting_roles_management 
SET booking_status = CASE 
  WHEN assigned_user_id IS NOT NULL THEN 'booked'
  ELSE 'open'
END
WHERE booking_status IS NULL OR booking_status = 'draft';

-- Set booked_at for existing bookings
UPDATE app_meeting_roles_management 
SET booked_at = updated_at
WHERE assigned_user_id IS NOT NULL 
  AND booking_status = 'booked' 
  AND booked_at IS NULL;

-- Create or replace trigger function to automatically manage booking status
CREATE OR REPLACE FUNCTION update_booking_status_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If assigned_user_id is being set (booking)
  IF NEW.assigned_user_id IS NOT NULL AND (OLD.assigned_user_id IS NULL OR OLD.assigned_user_id != NEW.assigned_user_id) THEN
    NEW.booking_status = 'booked';
    NEW.booked_at = NOW();
    NEW.withdrawn_at = NULL;
  -- If assigned_user_id is being cleared (unassigning)
  ELSIF NEW.assigned_user_id IS NULL AND OLD.assigned_user_id IS NOT NULL THEN
    NEW.booking_status = 'open';
    NEW.booked_at = NULL;
    NEW.withdrawn_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_booking_status ON app_meeting_roles_management;
CREATE TRIGGER trigger_update_booking_status
  BEFORE UPDATE ON app_meeting_roles_management
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_status_on_assignment();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meeting_roles_booking_status 
ON app_meeting_roles_management (booking_status);

CREATE INDEX IF NOT EXISTS idx_meeting_roles_booked_at 
ON app_meeting_roles_management (booked_at) 
WHERE booked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_roles_withdrawn_at 
ON app_meeting_roles_management (withdrawn_at) 
WHERE withdrawn_at IS NOT NULL;