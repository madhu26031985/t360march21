/*
  # Enhanced Attendance Automation on Poll Close
  
  ## Summary
  This migration enhances the existing attendance automation system to trigger when a poll is closed,
  ensuring all participants (voters and nominees) are marked present in one batch operation.
  
  ## New Functionality
  
  ### Function: auto_mark_attendance_on_poll_close
  - Triggers when a poll's status changes to "closed"
  - Finds all users who participated in the poll (either voted or were nominated)
  - Marks their attendance as "present" for that meeting
  - Works in batch mode for better performance
  
  ## How It Works
  
  1. **Poll Closes** → polls.status changed to 'closed'
  2. **Trigger Fires** → Checks if poll is linked to a meeting
  3. **Find Voters** → Gets all users who voted (from simple_poll_votes and poll_votes)
  4. **Find Nominees** → Gets all users who were nominated (from poll_items where option_id is UUID)
  5. **Mark Attendance** → Updates all participants' attendance to "present"
  
  ## Benefits
  
  - Batch processing: All participants marked at once
  - No timing issues: Happens only when poll officially closes
  - Manual override preserved: Admin can still manually mark attendance
  - Comprehensive: Captures both voters and nominees
  
  ## Security
  
  - Function runs as SECURITY DEFINER to access attendance records
  - Only updates existing attendance records (doesn't create new ones)
  - Logs all actions for audit trail
  - Graceful error handling to prevent poll closure failures
*/

-- Function to auto-mark attendance when a poll is closed
CREATE OR REPLACE FUNCTION auto_mark_attendance_on_poll_close()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_id uuid;
  v_meeting_date date;
  v_club_id uuid;
  v_affected_count integer := 0;
  v_user_ids uuid[];
BEGIN
  -- Only proceed if status changed to 'closed'
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    
    -- Get meeting details from the poll
    SELECT p.meeting_id, p.club_id, m.meeting_date
    INTO v_meeting_id, v_club_id, v_meeting_date
    FROM polls p
    LEFT JOIN app_club_meeting m ON p.meeting_id = m.id
    WHERE p.id = NEW.id;
    
    -- If poll is not linked to a meeting, exit
    IF v_meeting_id IS NULL THEN
      RAISE LOG 'Poll % is not linked to a meeting, skipping attendance marking', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Collect all user IDs who should be marked present
    -- This includes: voters from simple_poll_votes, voters from poll_votes, and nominees from poll_items
    
    WITH voters_simple AS (
      -- Get voters from simple_poll_votes
      SELECT DISTINCT user_id
      FROM simple_poll_votes
      WHERE poll_id = NEW.id
    ),
    voters_regular AS (
      -- Get voters from poll_votes
      SELECT DISTINCT user_id
      FROM poll_votes
      WHERE poll_id = NEW.id
    ),
    nominees AS (
      -- Get nominees from poll_items (where option_id is a valid UUID)
      SELECT DISTINCT option_id::uuid AS user_id
      FROM poll_items
      WHERE poll_id = NEW.id
        AND option_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND EXISTS (SELECT 1 FROM app_user_profiles WHERE id = option_id::uuid)
    ),
    all_participants AS (
      SELECT user_id FROM voters_simple
      UNION
      SELECT user_id FROM voters_regular
      UNION
      SELECT user_id FROM nominees
    )
    SELECT ARRAY_AGG(DISTINCT user_id)
    INTO v_user_ids
    FROM all_participants;
    
    -- If there are participants, mark their attendance
    IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
      
      -- Update attendance records to mark as present
      UPDATE app_meeting_attendance
      SET 
        attendance_status = 'present',
        attendance_marked_at = now(),
        updated_at = now()
      WHERE 
        meeting_id = v_meeting_id
        AND user_id = ANY(v_user_ids)
        AND (attendance_status IS NULL OR attendance_status != 'present'); -- Only update if not already present
      
      GET DIAGNOSTICS v_affected_count = ROW_COUNT;
      
      -- Log the action
      IF v_affected_count > 0 THEN
        RAISE LOG 'Auto-marked attendance for % users in meeting % when poll % was closed', 
          v_affected_count, v_meeting_id, NEW.id;
      ELSE
        RAISE LOG 'No attendance records updated for poll % - all participants may already be marked present', NEW.id;
      END IF;
      
    ELSE
      RAISE LOG 'No participants found for poll % to mark attendance', NEW.id;
    END IF;
    
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the poll closure
  RAISE WARNING 'Failed to auto-mark attendance on poll close for poll %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_mark_attendance_on_poll_close ON polls;

-- Create trigger for poll closure
CREATE TRIGGER trigger_auto_mark_attendance_on_poll_close
  AFTER UPDATE ON polls
  FOR EACH ROW
  WHEN (NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed'))
  EXECUTE FUNCTION auto_mark_attendance_on_poll_close();

-- Add comment for documentation
COMMENT ON FUNCTION auto_mark_attendance_on_poll_close() IS 
  'Automatically marks attendance as present for all poll participants (voters and nominees) when a poll is closed. Works in batch mode for better performance.';

COMMENT ON TRIGGER trigger_auto_mark_attendance_on_poll_close ON polls IS
  'Triggers automatic attendance marking when a poll status changes to closed';
