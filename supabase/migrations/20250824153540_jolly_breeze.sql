/*
  # Update Attendance Status Options

  1. Database Changes
    - Update attendance status constraint to include 'not_applicable'
    - Update existing 'late' status to 'not_applicable' where applicable
    - Add indexes for new status option

  2. Tables Modified
    - `meeting_attendance_snapshots` - attendance status constraint
    - Any other attendance-related tables with status constraints

  3. Data Migration
    - Convert any existing 'late' status to 'not_applicable'
    - Preserve existing 'present' and 'absent' statuses
*/

-- Update the attendance status constraint in meeting_attendance_snapshots
DO $$
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'meeting_attendance_snapshots_attendance_status_check' 
    AND table_name = 'meeting_attendance_snapshots'
  ) THEN
    ALTER TABLE meeting_attendance_snapshots 
    DROP CONSTRAINT meeting_attendance_snapshots_attendance_status_check;
  END IF;
  
  -- Add the new constraint with three options
  ALTER TABLE meeting_attendance_snapshots 
  ADD CONSTRAINT meeting_attendance_snapshots_attendance_status_check 
  CHECK (attendance_status = ANY (ARRAY['present'::text, 'absent'::text, 'not_applicable'::text]));
END $$;

-- Update any existing 'late' status to 'not_applicable'
UPDATE meeting_attendance_snapshots 
SET attendance_status = 'not_applicable', 
    updated_at = now()
WHERE attendance_status = 'late';

-- Update any other attendance tables if they exist
DO $$
BEGIN
  -- Check if attendance table exists and update its constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'attendance' AND table_schema = 'public'
  ) THEN
    -- Drop existing constraint
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'chk_attendance_type' 
      AND table_name = 'attendance'
    ) THEN
      ALTER TABLE attendance DROP CONSTRAINT chk_attendance_type;
    END IF;
    
    -- Add new constraint
    ALTER TABLE attendance 
    ADD CONSTRAINT chk_attendance_type 
    CHECK (attendance_type = ANY (ARRAY['present'::text, 'absent'::text, 'not_applicable'::text]));
    
    -- Update existing data
    UPDATE attendance 
    SET attendance_type = 'not_applicable' 
    WHERE attendance_type = 'late';
  END IF;
END $$;

-- Update user_performance_metrics table constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_user_performance_metrics_attendance_type' 
    AND table_name = 'user_performance_metrics'
  ) THEN
    ALTER TABLE user_performance_metrics 
    DROP CONSTRAINT chk_user_performance_metrics_attendance_type;
    
    ALTER TABLE user_performance_metrics 
    ADD CONSTRAINT chk_user_performance_metrics_attendance_type 
    CHECK (((attendance_type IS NULL) OR (attendance_type = ANY (ARRAY['present'::text, 'absent'::text, 'not_applicable'::text]))));
  END IF;
END $$;

-- Add index for the new status option
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_snapshots_not_applicable 
ON meeting_attendance_snapshots (attendance_status) 
WHERE attendance_status = 'not_applicable';

-- Add comment explaining the status options
COMMENT ON COLUMN meeting_attendance_snapshots.attendance_status IS 
'Attendance status: present (attended meeting), absent (did not attend), not_applicable (not expected to attend or special circumstances)';