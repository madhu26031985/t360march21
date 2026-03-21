/*
  # Automate Role Completion Based on Voting Nominations
  
  ## Overview
  This migration automates role completion tracking when users are nominated
  in voting polls. If a user has booked a role and is nominated for voting
  in the corresponding category, their role is automatically marked as completed.
  
  ## Business Logic
  
  When a user is nominated for voting:
  1. They must have booked a role for that meeting
  2. The voting category must match their role classification
  3. Role is marked as completed automatically
  
  ## Voting Category to Role Classification Mapping
  
  | Voting Question | Role Classifications |
  |----------------|---------------------|
  | Best Prepared Speaker | Prepared Speaker |
  | Best Speech Evaluator | Speech evaluvator, Master evaluvator |
  | Best Table Topics Speaker | On-the-Spot Speaking |
  | Best Ancillary Speaker | Ancillary Speaker |
  | Best Role Player | Key Speakers, Tag roles, Club Speakers, Educational speaker |
  
  ## How It Works
  
  1. Poll items are created with nominations (option_id = user_id)
  2. System checks if option_id is a valid user UUID
  3. Finds user's booked role for that meeting
  4. Maps voting question to role classification
  5. If match found, marks role as completed
  
  ## Functions
  
  ### get_role_classifications_for_voting_question(question_text)
  - Returns array of role classifications that match a voting question
  - Used to map voting categories to role types
  
  ### auto_complete_role_on_nomination()
  - Trigger function that runs when poll_items are inserted
  - Checks if nomination matches a booked role
  - Marks role as completed if conditions are met
  
  ## Security
  - Functions run as SECURITY DEFINER for access to role management
  - Only updates roles that are already booked by the nominated user
  - Logs all automatic completions for audit trail
*/

-- Function to map voting question to role classifications
CREATE OR REPLACE FUNCTION get_role_classifications_for_voting_question(question_text TEXT)
RETURNS TEXT[] AS $$
BEGIN
  -- Map voting questions to role classifications
  
  -- Best Prepared Speaker
  IF question_text ILIKE '%Best Prepared Speaker%' THEN
    RETURN ARRAY['Prepared Speaker'];
  
  -- Best Speech Evaluator (includes both Speech evaluator and Master evaluator)
  ELSIF question_text ILIKE '%Best Speech Evaluator%' OR question_text ILIKE '%Best Evaluator%' THEN
    RETURN ARRAY['Speech evaluvator', 'Master evaluvator'];
  
  -- Best Table Topics Speaker
  ELSIF question_text ILIKE '%Best Table Topics Speaker%' OR question_text ILIKE '%Table Topics%' THEN
    RETURN ARRAY['On-the-Spot Speaking', 'TT _ Evaluvator'];
  
  -- Best Ancillary Speaker
  ELSIF question_text ILIKE '%Best Ancillary Speaker%' OR question_text ILIKE '%Ancillary%' THEN
    RETURN ARRAY['Ancillary Speaker'];
  
  -- Best Role Player (covers Key Speakers, Tag roles, Club Speakers, Educational speaker)
  ELSIF question_text ILIKE '%Best Role Player%' OR question_text ILIKE '%Role Player%' THEN
    RETURN ARRAY['Key Speakers', 'Tag roles', 'Club Speakers', 'Educational speaker'];
  
  -- Default: return empty array if no match
  ELSE
    RETURN ARRAY[]::TEXT[];
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to automatically complete role when user is nominated
CREATE OR REPLACE FUNCTION auto_complete_role_on_nomination()
RETURNS TRIGGER AS $$
DECLARE
  v_nominated_user_id uuid;
  v_meeting_id uuid;
  v_meeting_date date;
  v_nomination_date date;
  v_role_classifications TEXT[];
  v_completed_count INTEGER := 0;
BEGIN
  -- Check if option_id is a valid UUID (indicates user nomination)
  BEGIN
    v_nominated_user_id := NEW.option_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    -- Not a UUID, so not a user nomination
    RETURN NEW;
  END;
  
  -- Get meeting details from the poll
  SELECT p.meeting_id, m.meeting_date
  INTO v_meeting_id, v_meeting_date
  FROM polls p
  JOIN app_club_meeting m ON p.meeting_id = m.id
  WHERE p.id = NEW.poll_id;
  
  -- If poll is not linked to a meeting, exit
  IF v_meeting_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get the date when the nomination was created
  v_nomination_date := DATE(NEW.created_at);
  
  -- Only process if nomination happened on the meeting date
  IF v_nomination_date != v_meeting_date THEN
    RETURN NEW;
  END IF;
  
  -- Check if the nominated user exists in app_user_profiles
  IF NOT EXISTS (SELECT 1 FROM app_user_profiles WHERE id = v_nominated_user_id) THEN
    RETURN NEW;
  END IF;
  
  -- Get role classifications that match this voting question
  v_role_classifications := get_role_classifications_for_voting_question(NEW.question_text);
  
  -- If no matching role classifications, exit
  IF array_length(v_role_classifications, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Update all roles that match the criteria:
  -- 1. User has booked the role (assigned_user_id matches)
  -- 2. Role is in the matching classification
  -- 3. Role is not already completed
  -- 4. Role is for this meeting
  UPDATE app_meeting_roles_management
  SET 
    is_completed = true,
    completed_at = NEW.created_at,
    completion_notes = COALESCE(completion_notes, '') || 
      CASE 
        WHEN completion_notes IS NULL OR completion_notes = '' 
        THEN 'Auto-completed: Nominated for voting in "' || NEW.question_text || '"'
        ELSE E'\n' || 'Auto-completed: Nominated for voting in "' || NEW.question_text || '"'
      END,
    updated_at = now()
  WHERE 
    meeting_id = v_meeting_id
    AND assigned_user_id = v_nominated_user_id
    AND role_classification = ANY(v_role_classifications)
    AND booking_status = 'booked'
    AND is_completed = false;
  
  -- Get count of updated rows
  GET DIAGNOSTICS v_completed_count = ROW_COUNT;
  
  -- Log the action if any roles were completed
  IF v_completed_count > 0 THEN
    RAISE LOG 'Auto-completed % role(s) for user % in meeting % due to nomination in "%"', 
      v_completed_count, v_nominated_user_id, v_meeting_id, NEW.question_text;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the nomination
  RAISE WARNING 'Failed to auto-complete role on nomination: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_complete_role_on_nomination ON poll_items;

-- Create trigger for role completion on nomination
CREATE TRIGGER trigger_auto_complete_role_on_nomination
  AFTER INSERT ON poll_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_role_on_nomination();

-- Add comments for documentation
COMMENT ON FUNCTION get_role_classifications_for_voting_question(TEXT) IS 
  'Maps voting question text to corresponding role classification(s) for automatic role completion';

COMMENT ON FUNCTION auto_complete_role_on_nomination() IS 
  'Automatically marks role as completed when user is nominated for voting in their role category';

-- Create a helper view to see role completion status
CREATE OR REPLACE VIEW role_completion_summary AS
SELECT 
  m.meeting_date,
  m.meeting_title,
  c.name as club_name,
  r.role_name,
  r.role_classification,
  aup.full_name as assigned_user,
  r.booking_status,
  r.is_completed,
  r.completed_at,
  r.completion_notes
FROM app_meeting_roles_management r
JOIN app_club_meeting m ON r.meeting_id = m.id
JOIN clubs c ON r.club_id = c.id
LEFT JOIN app_user_profiles aup ON r.assigned_user_id = aup.id
WHERE r.assigned_user_id IS NOT NULL
ORDER BY m.meeting_date DESC, r.role_classification, r.role_name;

COMMENT ON VIEW role_completion_summary IS 
  'Provides an overview of role assignments and completion status across all meetings';
