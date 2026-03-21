/*
  # Enhanced Role Completion on Poll Close
  
  ## Summary
  This migration enhances the existing role completion automation by triggering when a poll is closed,
  confirming that nominated users actually performed their roles (people voted on them).
  
  ## New Functionality
  
  ### Function: auto_complete_role_on_poll_close
  - Triggers when a poll's status changes to "closed"
  - Finds all users who were nominated in the poll
  - Maps the voting question to role classifications
  - Marks their corresponding roles as completed
  - Only processes users who have actually booked the role
  
  ## How It Works
  
  1. **Poll Closes** → polls.status changed to 'closed'
  2. **Trigger Fires** → Checks if poll is linked to a meeting
  3. **Find Nominees** → Gets all users nominated in poll_items (where option_id is UUID)
  4. **Map Categories** → Uses voting question text to determine role types
  5. **Mark Completed** → Updates all matching booked roles as completed
  
  ## Voting Category Mappings
  
  | Voting Question | Role Classifications |
  |----------------|---------------------|
  | Best Prepared Speaker | Prepared Speaker |
  | Best Speech Evaluator | Speech evaluvator, Master evaluvator |
  | Best Table Topics Speaker | On-the-Spot Speaking, TT _ Evaluvator |
  | Best Ancillary Speaker | Ancillary Speaker |
  | Best Role Player | Key Speakers, Tag roles, Club Speakers, Educational speaker |
  
  ## Benefits
  
  - Confirmation: Roles only marked complete when poll closes (proof of participation)
  - Batch processing: All nominees processed at once
  - Redundancy: Works alongside real-time nomination trigger
  - Manual override: Admins can still manually mark role completion
  
  ## Security
  
  - Function runs as SECURITY DEFINER for access to role management
  - Only updates roles that are already booked by the nominated user
  - Logs all automatic completions for audit trail
  - Graceful error handling to prevent poll closure failures
*/

-- Function to auto-complete roles when a poll is closed
CREATE OR REPLACE FUNCTION auto_complete_role_on_poll_close()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_id uuid;
  v_meeting_date date;
  v_nomination_record RECORD;
  v_role_classifications TEXT[];
  v_total_completed INTEGER := 0;
  v_completed_count INTEGER := 0;
BEGIN
  -- Only proceed if status changed to 'closed'
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    
    -- Get meeting details from the poll
    SELECT p.meeting_id, m.meeting_date
    INTO v_meeting_id, v_meeting_date
    FROM polls p
    LEFT JOIN app_club_meeting m ON p.meeting_id = m.id
    WHERE p.id = NEW.id;
    
    -- If poll is not linked to a meeting, exit
    IF v_meeting_id IS NULL THEN
      RAISE LOG 'Poll % is not linked to a meeting, skipping role completion', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Process each nomination in the poll
    FOR v_nomination_record IN 
      SELECT DISTINCT 
        pi.option_id::uuid AS nominated_user_id,
        pi.question_text
      FROM poll_items pi
      WHERE pi.poll_id = NEW.id
        AND pi.option_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND EXISTS (SELECT 1 FROM app_user_profiles WHERE id = pi.option_id::uuid)
    LOOP
      
      -- Get role classifications that match this voting question
      v_role_classifications := get_role_classifications_for_voting_question(v_nomination_record.question_text);
      
      -- Skip if no matching role classifications
      IF array_length(v_role_classifications, 1) IS NULL THEN
        CONTINUE;
      END IF;
      
      -- Update all roles that match the criteria:
      -- 1. User has booked the role (assigned_user_id matches)
      -- 2. Role is in the matching classification
      -- 3. Role is not already completed
      -- 4. Role is for this meeting
      UPDATE app_meeting_roles_management
      SET 
        is_completed = true,
        completed_at = now(),
        completion_notes = COALESCE(completion_notes, '') || 
          CASE 
            WHEN completion_notes IS NULL OR completion_notes = '' 
            THEN 'Auto-completed: Poll closed for "' || v_nomination_record.question_text || '"'
            ELSE E'\n' || 'Auto-completed: Poll closed for "' || v_nomination_record.question_text || '"'
          END,
        updated_at = now()
      WHERE 
        meeting_id = v_meeting_id
        AND assigned_user_id = v_nomination_record.nominated_user_id
        AND role_classification = ANY(v_role_classifications)
        AND booking_status = 'booked'
        AND is_completed = false;
      
      -- Get count of updated rows for this user
      GET DIAGNOSTICS v_completed_count = ROW_COUNT;
      v_total_completed := v_total_completed + v_completed_count;
      
      -- Log for each user if roles were completed
      IF v_completed_count > 0 THEN
        RAISE LOG 'Auto-completed % role(s) for user % in meeting % when poll % closed for "%"', 
          v_completed_count, v_nomination_record.nominated_user_id, v_meeting_id, 
          NEW.id, v_nomination_record.question_text;
      END IF;
      
    END LOOP;
    
    -- Log overall summary
    IF v_total_completed > 0 THEN
      RAISE LOG 'Poll % closure completed % total role(s) in meeting %', 
        NEW.id, v_total_completed, v_meeting_id;
    ELSE
      RAISE LOG 'Poll % closed but no roles needed completion (may already be completed)', NEW.id;
    END IF;
    
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the poll closure
  RAISE WARNING 'Failed to auto-complete roles on poll close for poll %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_complete_role_on_poll_close ON polls;

-- Create trigger for role completion on poll closure
CREATE TRIGGER trigger_auto_complete_role_on_poll_close
  AFTER UPDATE ON polls
  FOR EACH ROW
  WHEN (NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed'))
  EXECUTE FUNCTION auto_complete_role_on_poll_close();

-- Add comment for documentation
COMMENT ON FUNCTION auto_complete_role_on_poll_close() IS 
  'Automatically marks roles as completed for all nominated users when a poll is closed. This confirms they performed their role and people voted on them.';

COMMENT ON TRIGGER trigger_auto_complete_role_on_poll_close ON polls IS
  'Triggers automatic role completion when a poll status changes to closed';
