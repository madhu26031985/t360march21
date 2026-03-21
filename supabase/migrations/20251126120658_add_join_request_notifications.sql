/*
  # Add Join Request Notifications

  1. New Functions
    - `notify_user_on_request_status_change` - Sends notification when request is approved/rejected
  
  2. New Triggers
    - Trigger on `club_join_requests` UPDATE to send notifications
  
  3. Notifications Sent
    - When request is approved: "Your request to join [Club Name] has been approved!"
    - When request is rejected: "Your request to join [Club Name] was not approved."
*/

-- Function to send notification when request status changes
CREATE OR REPLACE FUNCTION notify_user_on_request_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_club_name TEXT;
BEGIN
  -- Only proceed if status changed from pending to approved/rejected
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    -- Get club name
    SELECT name INTO v_club_name
    FROM clubs
    WHERE id = NEW.club_id;

    -- Send appropriate notification
    IF NEW.status = 'approved' THEN
      INSERT INTO notifications (user_id, title, message, type, is_read, data)
      VALUES (
        NEW.user_id,
        'Join Request Approved',
        'Your request to join ' || v_club_name || ' has been approved! You can now access the club.',
        'join_request_approved',
        false,
        jsonb_build_object(
          'club_id', NEW.club_id,
          'club_name', v_club_name,
          'request_id', NEW.id
        )
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO notifications (user_id, title, message, type, is_read, data)
      VALUES (
        NEW.user_id,
        'Join Request Not Approved',
        'Your request to join ' || v_club_name || ' was not approved at this time.',
        'join_request_rejected',
        false,
        jsonb_build_object(
          'club_id', NEW.club_id,
          'club_name', v_club_name,
          'request_id', NEW.id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for join request status changes
DROP TRIGGER IF EXISTS on_join_request_status_change ON club_join_requests;

CREATE TRIGGER on_join_request_status_change
  AFTER UPDATE ON club_join_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_user_on_request_status_change();
