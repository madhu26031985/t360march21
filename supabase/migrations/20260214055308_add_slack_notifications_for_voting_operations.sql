/*
  # Add Slack Notifications for Voting Operations

  1. Changes
    - Creates database triggers on polls table
    - Automatically sends Slack notifications when:
      - A new poll is created (INSERT)
      - A poll is updated (UPDATE)
      - A poll is closed (status changes to 'completed')
    - Uses the notify-slack-voting-operations edge function

  2. Security
    - Function runs with SECURITY DEFINER privileges to bypass RLS
    - Triggers on INSERT and UPDATE operations
*/

-- Create function to notify Slack when a poll is created or updated
CREATE OR REPLACE FUNCTION notify_slack_on_voting_operation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://chtkcretrpygqmwtyonx.supabase.co';
  supabase_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodGtjcmV0cnB5Z3Ftd3R5b254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODkxMzAsImV4cCI6MjA2NjU2NTEzMH0.RzEPVTh22ZJrq5tnSHK5PQCLXRb5YUNU16EyDFk_ntU';
  operation_type text;
BEGIN
  -- Determine operation type
  IF TG_OP = 'INSERT' THEN
    operation_type := 'INSERT';
  ELSIF TG_OP = 'UPDATE' THEN
    operation_type := 'UPDATE';
  ELSE
    RETURN NEW;
  END IF;

  -- Make async request to edge function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-slack-voting-operations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_anon_key
    ),
    body := jsonb_build_object(
      'record', to_jsonb(NEW),
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
      'operation', operation_type
    )
  ) INTO request_id;

  -- Log the notification attempt
  RAISE LOG 'Slack notification triggered for poll % operation: % (request_id: %)', operation_type, NEW.id, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE LOG 'Failed to send Slack notification for poll %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for new polls (INSERT)
DROP TRIGGER IF EXISTS on_poll_created ON polls;

CREATE TRIGGER on_poll_created
  AFTER INSERT ON polls
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_voting_operation();

-- Create trigger for poll updates (UPDATE)
DROP TRIGGER IF EXISTS on_poll_updated ON polls;

CREATE TRIGGER on_poll_updated
  AFTER UPDATE ON polls
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_voting_operation();
