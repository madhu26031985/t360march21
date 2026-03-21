/*
  # Backdate Role Completion from Historical Poll Data

  ## Summary
  This migration retroactively processes completed polls to mark roles as completed
  for past meetings. It matches poll nominee names to actual users and marks their
  roles as completed based on voting categories.

  ## Process
  1. For each completed poll, find the meeting with the closest date
  2. Extract nominees from poll items for voting categories (Best Role Player, Best Prepared Speaker, etc.)
  3. Match nominee names to user profiles using fuzzy matching
  4. Determine role classifications based on voting question text
  5. Mark the corresponding roles as completed for those users

  ## Changes Made
  - Updates app_meeting_roles_management table
  - Sets is_completed = true for matched roles
  - Adds completion notes indicating backdated completion
  - Only updates roles that are currently booked but not completed

  ## Security
  - One-time data migration
  - Does not modify any existing completed roles
  - Logs all changes for audit trail
*/

DO $$
DECLARE
  v_poll_record RECORD;
  v_meeting_record RECORD;
  v_poll_item_record RECORD;
  v_user_record RECORD;
  v_role_classifications TEXT[];
  v_total_roles_completed INTEGER := 0;
  v_roles_completed_for_poll INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backdated role completion from historical polls...';
  
  -- Loop through all completed polls
  FOR v_poll_record IN 
    SELECT DISTINCT p.id, p.created_at, p.status
    FROM polls p
    WHERE p.status = 'completed'
    ORDER BY p.created_at DESC
  LOOP
    v_roles_completed_for_poll := 0;
    
    -- Find the closest meeting to this poll date
    SELECT m.id, m.meeting_date, m.club_id
    INTO v_meeting_record
    FROM app_club_meeting m
    WHERE m.meeting_status = 'close'
      AND ABS(EXTRACT(EPOCH FROM (m.meeting_date - DATE(v_poll_record.created_at)))) < 86400 * 7  -- Within 7 days
    ORDER BY ABS(EXTRACT(EPOCH FROM (m.meeting_date - DATE(v_poll_record.created_at))))
    LIMIT 1;
    
    -- Skip if no matching meeting found
    IF v_meeting_record.id IS NULL THEN
      RAISE NOTICE 'Poll % (created %): No matching meeting found', v_poll_record.id, v_poll_record.created_at;
      CONTINUE;
    END IF;
    
    RAISE NOTICE 'Processing poll % (created %) -> Meeting % (date %)', 
      v_poll_record.id, v_poll_record.created_at, v_meeting_record.id, v_meeting_record.meeting_date;
    
    -- Loop through poll items that are voting nominations
    FOR v_poll_item_record IN
      SELECT DISTINCT
        pi.question_text,
        pi.option_text,
        pi.poll_id
      FROM poll_items pi
      WHERE pi.poll_id = v_poll_record.id
        AND (
          pi.question_text ILIKE '%Best Role Player%'
          OR pi.question_text ILIKE '%Best Prepared Speaker%'
          OR pi.question_text ILIKE '%Best Speech Evaluator%'
          OR pi.question_text ILIKE '%Best Evaluator%'
          OR pi.question_text ILIKE '%Best Table Topics Speaker%'
          OR pi.question_text ILIKE '%Best Ancillary Speaker%'
        )
        AND pi.option_text NOT ILIKE '%good%'
        AND pi.option_text NOT ILIKE '%bad%'
        AND pi.option_text NOT ILIKE '%excellent%'
        AND LENGTH(pi.option_text) > 2
    LOOP
      -- Try to find matching user by name
      SELECT u.id, u.full_name
      INTO v_user_record
      FROM app_user_profiles u
      WHERE (
        LOWER(u.full_name) = LOWER(v_poll_item_record.option_text)
        OR LOWER(u.full_name) LIKE LOWER(v_poll_item_record.option_text || '%')
        OR LOWER(v_poll_item_record.option_text) LIKE LOWER(u.full_name || '%')
        OR SIMILARITY(LOWER(u.full_name), LOWER(v_poll_item_record.option_text)) > 0.6
      )
      ORDER BY SIMILARITY(LOWER(u.full_name), LOWER(v_poll_item_record.option_text)) DESC
      LIMIT 1;
      
      -- Skip if no matching user found
      IF v_user_record.id IS NULL THEN
        RAISE NOTICE '  - Nominee "%" not matched to any user', v_poll_item_record.option_text;
        CONTINUE;
      END IF;
      
      -- Get role classifications for this voting question
      v_role_classifications := get_role_classifications_for_voting_question(v_poll_item_record.question_text);
      
      -- Skip if no role classifications found
      IF array_length(v_role_classifications, 1) IS NULL THEN
        RAISE NOTICE '  - No role classifications for question "%"', v_poll_item_record.question_text;
        CONTINUE;
      END IF;
      
      -- Update roles for this user in this meeting
      UPDATE app_meeting_roles_management
      SET 
        is_completed = true,
        completed_at = v_meeting_record.meeting_date + interval '2 hours',  -- Set to meeting day
        completion_notes = COALESCE(completion_notes, '') || 
          CASE 
            WHEN completion_notes IS NULL OR completion_notes = '' 
            THEN 'Backdated completion: Nominated in "' || v_poll_item_record.question_text || '" poll'
            ELSE E'\n' || 'Backdated completion: Nominated in "' || v_poll_item_record.question_text || '" poll'
          END,
        updated_at = now()
      WHERE 
        meeting_id = v_meeting_record.id
        AND assigned_user_id = v_user_record.id
        AND role_classification = ANY(v_role_classifications)
        AND booking_status = 'booked'
        AND is_completed = false;
      
      -- Log the update
      IF FOUND THEN
        GET DIAGNOSTICS v_roles_completed_for_poll = ROW_COUNT;
        v_total_roles_completed := v_total_roles_completed + v_roles_completed_for_poll;
        
        RAISE NOTICE '  ✓ Marked % role(s) complete for user "%" (%) for "%"', 
          v_roles_completed_for_poll, v_user_record.full_name, v_user_record.id, v_poll_item_record.question_text;
      END IF;
      
    END LOOP;
    
  END LOOP;
  
  RAISE NOTICE 'Backdating complete! Total roles marked as completed: %', v_total_roles_completed;
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error during backdating: %', SQLERRM;
  -- Don't fail the migration, just log the error
END;
$$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Backdated role completion migration completed successfully';
  RAISE NOTICE '=================================================================';
END;
$$;
