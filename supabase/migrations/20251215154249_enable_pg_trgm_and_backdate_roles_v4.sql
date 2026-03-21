/*
  # Enable pg_trgm and Backdate Role Completions (v4)
  
  ## Summary
  This migration enables the pg_trgm extension for fuzzy text matching and then
  retroactively processes completed polls to mark roles as completed for past meetings.
  
  ## Changes
  1. Enables pg_trgm extension for similarity matching
  2. Matches poll nominee names to user profiles using fuzzy matching
  3. Updates role completion status for historical meetings
  
  ## Process
  - Uses fuzzy name matching (SIMILARITY) to connect poll nominees to actual users
  - Maps voting categories to role classifications (Key Speakers, Prepared Speaker, etc.)
  - Marks booked roles as completed with backdated audit notes
  - Only updates roles that are booked but not yet completed
  
  ## Role Classification Mapping
  - Best Role Player → Key Speakers
  - Best Prepared Speaker → Prepared Speaker
  - Best Speech Evaluator → Speech evaluvator, Master evaluvator, TT _ Evaluvator
  - Best Table Topics Speaker → On-the-Spot Speaking
  - Best Ancillary Speaker → Tag roles
*/

-- Enable pg_trgm extension for similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Backdate role completions
DO $$
DECLARE
  v_poll_record RECORD;
  v_meeting_record RECORD;
  v_poll_item_record RECORD;
  v_user_record RECORD;
  v_role_classifications TEXT[];
  v_total_roles_completed INTEGER := 0;
  v_roles_completed_for_item INTEGER := 0;
  v_poll_count INTEGER := 0;
  v_meeting_count INTEGER := 0;
  v_poll_date DATE;
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Starting backdated role completion from historical polls...';
  RAISE NOTICE '=================================================================';
  
  -- Loop through all completed polls
  FOR v_poll_record IN 
    SELECT p.id, p.created_at::timestamp, p.status
    FROM polls p
    WHERE p.status = 'completed'
    ORDER BY p.created_at DESC
  LOOP
    v_poll_count := v_poll_count + 1;
    v_poll_date := v_poll_record.created_at::date;
    
    -- Find the closest meeting to this poll date
    SELECT m.id, m.meeting_date, m.club_id
    INTO v_meeting_record
    FROM app_club_meeting m
    WHERE m.meeting_status = 'close'
      AND ABS(m.meeting_date - v_poll_date) <= 7  -- Within 7 days
    ORDER BY ABS(m.meeting_date - v_poll_date)
    LIMIT 1;
    
    -- Skip if no matching meeting found
    IF v_meeting_record.id IS NULL THEN
      RAISE NOTICE 'Poll % (created %): No matching meeting found within 7 days', 
        v_poll_record.id, v_poll_date;
      CONTINUE;
    END IF;
    
    v_meeting_count := v_meeting_count + 1;
    RAISE NOTICE '';
    RAISE NOTICE '>>> Processing Poll % (created %) -> Meeting % (date %)', 
      v_poll_record.id, v_poll_date, v_meeting_record.id, v_meeting_record.meeting_date;
    
    -- Loop through poll items that are voting nominations
    FOR v_poll_item_record IN
      SELECT 
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
        AND pi.option_text NOT ILIKE '%average%'
        AND LENGTH(pi.option_text) > 2
      GROUP BY pi.question_text, pi.option_text, pi.poll_id
    LOOP
      -- Try to find matching user by name with fuzzy matching
      SELECT 
        u.id, 
        u.full_name,
        SIMILARITY(LOWER(u.full_name), LOWER(v_poll_item_record.option_text)) as sim_score
      INTO v_user_record
      FROM app_user_profiles u
      INNER JOIN app_club_user_relationship cur ON cur.user_id = u.id
      WHERE cur.club_id = v_meeting_record.club_id
        AND cur.is_authenticated = true
        AND (
          LOWER(u.full_name) = LOWER(v_poll_item_record.option_text)
          OR LOWER(u.full_name) LIKE LOWER(v_poll_item_record.option_text || '%')
          OR LOWER(v_poll_item_record.option_text) LIKE LOWER(u.full_name || '%')
          OR SIMILARITY(LOWER(u.full_name), LOWER(v_poll_item_record.option_text)) > 0.5
        )
      ORDER BY SIMILARITY(LOWER(u.full_name), LOWER(v_poll_item_record.option_text)) DESC
      LIMIT 1;
      
      -- Skip if no matching user found
      IF v_user_record.id IS NULL THEN
        RAISE NOTICE '    ✗ Nominee "%" not matched to any user', v_poll_item_record.option_text;
        CONTINUE;
      END IF;
      
      -- Get role classifications for this voting question
      v_role_classifications := get_role_classifications_for_voting_question(v_poll_item_record.question_text);
      
      -- Skip if no role classifications found
      IF array_length(v_role_classifications, 1) IS NULL THEN
        RAISE NOTICE '    ✗ No role classifications for question "%"', v_poll_item_record.question_text;
        CONTINUE;
      END IF;
      
      -- Update roles for this user in this meeting
      WITH updated_roles AS (
        UPDATE app_meeting_roles_management
        SET 
          is_completed = true,
          completed_at = v_meeting_record.meeting_date + interval '2 hours',
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
          AND is_completed = false
        RETURNING id
      )
      SELECT COUNT(*) INTO v_roles_completed_for_item FROM updated_roles;
      
      v_total_roles_completed := v_total_roles_completed + v_roles_completed_for_item;
      
      -- Log the result
      IF v_roles_completed_for_item > 0 THEN
        RAISE NOTICE '    ✓ Marked % role(s) complete for "%" (matched: %) for "%"', 
          v_roles_completed_for_item, v_poll_item_record.option_text, v_user_record.full_name, 
          v_poll_item_record.question_text;
      ELSE
        RAISE NOTICE '    ○ No booked roles to complete for "%" for "%"', 
          v_poll_item_record.option_text, v_poll_item_record.question_text;
      END IF;
      
    END LOOP;
    
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Backdating Summary:';
  RAISE NOTICE '  - Processed % polls', v_poll_count;
  RAISE NOTICE '  - Matched % meetings', v_meeting_count;
  RAISE NOTICE '  - Marked % roles as completed', v_total_roles_completed;
  RAISE NOTICE '=================================================================';
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error during backdating: %', SQLERRM;
  RAISE EXCEPTION 'Backdating failed: %', SQLERRM;
END;
$$;
