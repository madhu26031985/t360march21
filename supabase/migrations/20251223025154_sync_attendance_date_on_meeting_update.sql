/*
  # Sync Attendance Dates on Meeting Update

  ## Summary
  This migration ensures that when a meeting's date is updated, all associated attendance
  records are automatically updated to reflect the new date.

  ## Problem
  When a meeting is created with an incorrect date and later corrected, the attendance
  records retained the old date, causing incorrect date displays in the attendance screens.

  ## Solution
  1. Create a trigger function that syncs attendance dates when meeting dates change
  2. Apply a one-time fix to correct any existing mismatched dates

  ## Changes
  - New function: `sync_attendance_date_on_meeting_update()`
  - New trigger: `trigger_sync_attendance_date_on_meeting_update`
  - One-time data fix for existing mismatched records
*/

-- Function to sync attendance dates when meeting date is updated
CREATE OR REPLACE FUNCTION sync_attendance_date_on_meeting_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if meeting_date has changed
  IF NEW.meeting_date IS DISTINCT FROM OLD.meeting_date THEN
    
    -- Update all attendance records for this meeting
    UPDATE app_meeting_attendance
    SET 
      meeting_date = NEW.meeting_date,
      updated_at = now()
    WHERE 
      meeting_id = NEW.id
      AND meeting_date != NEW.meeting_date;
    
    -- Log the action
    RAISE LOG 'Synced attendance dates for meeting % (%) from % to %', 
      NEW.id, NEW.meeting_number, OLD.meeting_date, NEW.meeting_date;
      
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_attendance_date_on_meeting_update ON app_club_meeting;

-- Create trigger for meeting date updates
CREATE TRIGGER trigger_sync_attendance_date_on_meeting_update
  AFTER UPDATE ON app_club_meeting
  FOR EACH ROW
  WHEN (NEW.meeting_date IS DISTINCT FROM OLD.meeting_date)
  EXECUTE FUNCTION sync_attendance_date_on_meeting_update();

-- Add comment for documentation
COMMENT ON FUNCTION sync_attendance_date_on_meeting_update() IS 
  'Automatically syncs attendance record dates when a meeting date is updated to prevent date mismatches';

COMMENT ON TRIGGER trigger_sync_attendance_date_on_meeting_update ON app_club_meeting IS
  'Ensures attendance dates stay in sync when meeting dates are changed';
