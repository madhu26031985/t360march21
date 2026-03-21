/*
  # Handle Expired Join Requests

  1. New Functions
    - `process_expired_join_requests` - Marks expired requests and sends notifications
  
  2. Changes
    - Updates expired pending requests to 'expired' status
    - Sends notifications to users about expired requests
  
  3. Usage
    - Can be called manually or via a cron job
    - Processes all pending requests that have passed their expiry time
*/

-- Function to process expired join requests
CREATE OR REPLACE FUNCTION process_expired_join_requests()
RETURNS TABLE (
  processed_count INTEGER,
  request_ids UUID[]
) AS $$
DECLARE
  v_expired_requests RECORD;
  v_club_name TEXT;
  v_count INTEGER := 0;
  v_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Loop through all expired pending requests
  FOR v_expired_requests IN
    SELECT id, user_id, club_id
    FROM club_join_requests
    WHERE status = 'pending'
      AND expires_at < NOW()
  LOOP
    -- Get club name
    SELECT name INTO v_club_name
    FROM clubs
    WHERE id = v_expired_requests.club_id;

    -- Update request status to expired
    UPDATE club_join_requests
    SET status = 'expired'
    WHERE id = v_expired_requests.id;

    -- Send notification
    INSERT INTO notifications (user_id, title, message, type, is_read, data)
    VALUES (
      v_expired_requests.user_id,
      'Join Request Expired',
      'Your request to join ' || v_club_name || ' has expired. Please submit a new request if you would like to join.',
      'join_request_expired',
      false,
      jsonb_build_object(
        'club_id', v_expired_requests.club_id,
        'club_name', v_club_name,
        'request_id', v_expired_requests.id
      )
    );

    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_expired_requests.id);
  END LOOP;

  RETURN QUERY SELECT v_count, v_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add 'expired' status to the enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'expired'
      AND enumtypid = (
        SELECT oid
        FROM pg_type
        WHERE typname = 'club_join_request_status'
      )
  ) THEN
    ALTER TYPE club_join_request_status ADD VALUE 'expired';
  END IF;
END $$;
