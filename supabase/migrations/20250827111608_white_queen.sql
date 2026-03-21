/*
  # Disable Automatic Attendance Snapshot Creation Trigger

  1. Changes
    - Drop the trigger that automatically creates attendance snapshots when meetings are created
    - This allows for manual attendance management instead of automatic snapshot creation

  2. Security
    - No security changes needed
    - Existing RLS policies remain intact

  3. Notes
    - This disables the automatic creation of attendance records
    - Attendance will need to be managed manually through the admin interface
    - Existing attendance snapshots are preserved
*/

-- Drop the trigger that automatically creates attendance snapshots
DROP TRIGGER IF EXISTS trigger_populate_meeting_attendance_snapshots ON app_club_meeting;

-- Drop the associated function if it's no longer needed elsewhere
-- Note: Only drop if this function is not used by other triggers
DROP FUNCTION IF EXISTS populate_meeting_attendance_snapshots();