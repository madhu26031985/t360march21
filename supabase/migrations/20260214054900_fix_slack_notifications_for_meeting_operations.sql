/*
  # Fix Slack Notifications for Meeting Operations

  1. Changes
    - Creates database triggers on app_club_meeting table (the correct table)
    - Automatically sends Slack notifications when:
      - A new meeting is created (INSERT)
      - A meeting is edited (UPDATE)
      - A meeting is closed (status changes to 'closed')
    - Uses the notify-slack-meeting-operations edge function
    - Removes old triggers from incorrect table

  2. Security
    - Function runs with SECURITY DEFINER privileges to bypass RLS
    - Triggers on INSERT and UPDATE operations
*/

-- Drop old triggers from wrong table
DROP TRIGGER IF EXISTS on_meeting_created ON meetings;
DROP TRIGGER IF EXISTS on_meeting_updated ON meetings;

-- Create updated function to notify Slack when a meeting is created or updated
CREATE OR REPLACE FUNCTION notify_slack_on_meeting_operation()
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
  normalized_record jsonb;
  normalized_old_record jsonb;
BEGIN
  -- Determine operation type
  IF TG_OP = 'INSERT' THEN
    operation_type := 'INSERT';
  ELSIF TG_OP = 'UPDATE' THEN
    operation_type := 'UPDATE';
  ELSE
    RETURN NEW;
  END IF;

  -- Normalize the record to match expected format
  normalized_record := jsonb_build_object(
    'id', NEW.id,
    'title', NEW.meeting_title,
    'meeting_number', NEW.meeting_number,
    'theme', NEW.theme,
    'meeting_date', NEW.meeting_date,
    'meeting_time', NEW.meeting_start_time,
    'mode', NEW.meeting_mode,
    'location', NEW.meeting_location,
    'status', NEW.meeting_status,
    'club_id', NEW.club_id,
    'created_at', NEW.created_at
  );

  -- Normalize old record if update
  IF TG_OP = 'UPDATE' THEN
    normalized_old_record := jsonb_build_object(
      'id', OLD.id,
      'title', OLD.meeting_title,
      'meeting_number', OLD.meeting_number,
      'theme', OLD.theme,
      'meeting_date', OLD.meeting_date,
      'meeting_time', OLD.meeting_start_time,
      'mode', OLD.meeting_mode,
      'location', OLD.meeting_location,
      'status', OLD.meeting_status,
      'club_id', OLD.club_id,
      'created_at', OLD.created_at
    );
  ELSE
    normalized_old_record := NULL;
  END IF;

  -- Make async request to edge function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-slack-meeting-operations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_anon_key
    ),
    body := jsonb_build_object(
      'record', normalized_record,
      'old_record', normalized_old_record,
      'operation', operation_type
    )
  ) INTO request_id;

  -- Log the notification attempt
  RAISE LOG 'Slack notification triggered for meeting % operation: % (request_id: %)', operation_type, NEW.id, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE LOG 'Failed to send Slack notification for meeting %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for new meetings (INSERT)
DROP TRIGGER IF EXISTS on_app_club_meeting_created ON app_club_meeting;

CREATE TRIGGER on_app_club_meeting_created
  AFTER INSERT ON app_club_meeting
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_meeting_operation();

-- Create trigger for meeting updates (UPDATE)
DROP TRIGGER IF EXISTS on_app_club_meeting_updated ON app_club_meeting;

CREATE TRIGGER on_app_club_meeting_updated
  AFTER UPDATE ON app_club_meeting
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_meeting_operation();
