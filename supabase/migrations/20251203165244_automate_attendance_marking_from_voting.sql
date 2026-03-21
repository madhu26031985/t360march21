/*
  # Automate Attendance Marking from Voting Participation
  
  ## Overview
  This migration automates attendance marking based on voting participation.
  If a user votes or is nominated for voting on the day of a meeting, 
  their attendance is automatically marked as "present".
  
  ## Implementation
  
  ### 1. Function: auto_mark_attendance_on_vote
  - Triggers when a user casts a vote in simple_poll_votes
  - Checks if the poll is linked to a meeting
  - Verifies if the vote happened on the meeting date
  - Marks the user as present in app_meeting_attendance
  
  ### 2. Function: auto_mark_attendance_on_nomination
  - Triggers when poll_items are created (nominations)
  - Checks if option_id is a valid user_id (UUID format)
  - Verifies if nomination is for a meeting on that day
  - Marks the nominated user as present in app_meeting_attendance
  
  ## How It Works
  
  ### Voting Scenario:
  - User votes on a poll → simple_poll_votes insert
  - Trigger fires → Checks meeting date
  - If vote date = meeting date → Mark present
  
  ### Nomination Scenario:
  - Poll options created with user nominations → poll_items insert
  - Trigger fires → Checks if option_id is user_id
  - If nomination date = meeting date → Mark nominated user present
  
  ## Security
  - Functions run as SECURITY DEFINER to access attendance records
  - Only updates existing attendance records (doesn't create new ones)
  - Logs actions for audit trail
*/

-- Function to auto-mark attendance when someone votes
CREATE OR REPLACE FUNCTION auto_mark_attendance_on_vote()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_id uuid;
  v_meeting_date date;
  v_club_id uuid;
  v_vote_date date;
BEGIN
  -- Get meeting details from the poll
  SELECT p.meeting_id, p.club_id, m.meeting_date
  INTO v_meeting_id, v_club_id, v_meeting_date
  FROM polls p
  JOIN app_club_meeting m ON p.meeting_id = m.id
  WHERE p.id = NEW.poll_id;
  
  -- If poll is not linked to a meeting, exit
  IF v_meeting_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get the date when the vote was cast
  v_vote_date := DATE(NEW.created_at);
  
  -- Only mark attendance if vote happened on the meeting date
  IF v_vote_date = v_meeting_date THEN
    -- Update attendance record to mark as present
    UPDATE app_meeting_attendance
    SET 
      attendance_status = 'present',
      attendance_marked_at = NEW.created_at,
      updated_at = now()
    WHERE 
      meeting_id = v_meeting_id
      AND user_id = NEW.user_id
      AND attendance_status != 'present'; -- Only update if not already present
    
    -- Log the action
    IF FOUND THEN
      RAISE LOG 'Auto-marked attendance for user % in meeting % due to voting', 
        NEW.user_id, v_meeting_id;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the vote
  RAISE WARNING 'Failed to auto-mark attendance on vote: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-mark attendance when someone is nominated
CREATE OR REPLACE FUNCTION auto_mark_attendance_on_nomination()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_id uuid;
  v_meeting_date date;
  v_club_id uuid;
  v_nomination_date date;
  v_nominated_user_id uuid;
BEGIN
  -- Check if option_id is a valid UUID (user_id for nominations)
  BEGIN
    v_nominated_user_id := NEW.option_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    -- Not a UUID, so not a user nomination
    RETURN NEW;
  END;
  
  -- Get meeting details from the poll
  SELECT p.meeting_id, p.club_id, m.meeting_date
  INTO v_meeting_id, v_club_id, v_meeting_date
  FROM polls p
  JOIN app_club_meeting m ON p.meeting_id = m.id
  WHERE p.id = NEW.poll_id;
  
  -- If poll is not linked to a meeting, exit
  IF v_meeting_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get the date when the nomination was created
  v_nomination_date := DATE(NEW.created_at);
  
  -- Only mark attendance if nomination happened on the meeting date
  IF v_nomination_date = v_meeting_date THEN
    -- Check if the user exists in app_user_profiles
    IF EXISTS (SELECT 1 FROM app_user_profiles WHERE id = v_nominated_user_id) THEN
      -- Update attendance record to mark as present
      UPDATE app_meeting_attendance
      SET 
        attendance_status = 'present',
        attendance_marked_at = NEW.created_at,
        updated_at = now()
      WHERE 
        meeting_id = v_meeting_id
        AND user_id = v_nominated_user_id
        AND attendance_status != 'present'; -- Only update if not already present
      
      -- Log the action
      IF FOUND THEN
        RAISE LOG 'Auto-marked attendance for user % in meeting % due to nomination', 
          v_nominated_user_id, v_meeting_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the nomination
  RAISE WARNING 'Failed to auto-mark attendance on nomination: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_auto_mark_attendance_on_vote ON simple_poll_votes;
DROP TRIGGER IF EXISTS trigger_auto_mark_attendance_on_nomination ON poll_items;

-- Create trigger for voting
CREATE TRIGGER trigger_auto_mark_attendance_on_vote
  AFTER INSERT ON simple_poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_attendance_on_vote();

-- Create trigger for nominations
CREATE TRIGGER trigger_auto_mark_attendance_on_nomination
  AFTER INSERT ON poll_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_attendance_on_nomination();

-- Add comments for documentation
COMMENT ON FUNCTION auto_mark_attendance_on_vote() IS 
  'Automatically marks user attendance as present when they vote on a poll during a meeting day';

COMMENT ON FUNCTION auto_mark_attendance_on_nomination() IS 
  'Automatically marks user attendance as present when they are nominated in a poll during a meeting day';
