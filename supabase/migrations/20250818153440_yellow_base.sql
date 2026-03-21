/*
  # Update attendance status options

  1. Changes
    - Remove 'late' option from attendance_status
    - Keep only 'present' and 'absent' options
    - Update check constraint to enforce new values
    - Update function documentation

  2. Security
    - Maintain existing RLS policies
    - No changes to permissions
*/

-- Update the check constraint to only allow 'present' and 'absent'
ALTER TABLE app_meeting_attendance 
DROP CONSTRAINT IF EXISTS app_meeting_attendance_attendance_status_check;

ALTER TABLE app_meeting_attendance 
ADD CONSTRAINT app_meeting_attendance_attendance_status_check 
CHECK (attendance_status = ANY (ARRAY['present'::text, 'absent'::text]));

-- Update any existing 'late' records to 'present' (assuming late means they were there)
UPDATE app_meeting_attendance 
SET attendance_status = 'present' 
WHERE attendance_status = 'late';

-- Update the function documentation
COMMENT ON FUNCTION populate_meeting_attendance() IS 'Automatically creates attendance records for all club members when a new meeting is created. Sets default status to present and preserves user data as snapshot.';

-- Update the trigger function to handle only present/absent
CREATE OR REPLACE FUNCTION update_app_meeting_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate attendance status
  IF NEW.attendance_status NOT IN ('present', 'absent') THEN
    RAISE EXCEPTION 'Invalid attendance status. Must be present or absent.';
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;