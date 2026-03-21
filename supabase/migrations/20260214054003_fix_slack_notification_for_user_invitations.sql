/*
  # Fix Slack Notification for User Invitations

  1. Changes
    - Updates the trigger function to use hardcoded Supabase URL
    - Removes dependency on database configuration settings
    - Makes the notification system more reliable

  2. Security
    - Function runs with SECURITY DEFINER privileges to bypass RLS
    - Only triggers on INSERT operations for new invitations
*/

-- Update function to use hardcoded Supabase URL
CREATE OR REPLACE FUNCTION notify_slack_on_user_invitation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://chtkcretrpygqmwtyonx.supabase.co';
  supabase_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodGtjcmV0cnB5Z3Ftd3R5b254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODkxMzAsImV4cCI6MjA2NjU2NTEzMH0.RzEPVTh22ZJrq5tnSHK5PQCLXRb5YUNU16EyDFk_ntU';
BEGIN
  -- Make async request to edge function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-slack-user-invitation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_anon_key
    ),
    body := jsonb_build_object('record', to_jsonb(NEW))
  ) INTO request_id;

  -- Log the notification attempt
  RAISE LOG 'Slack notification triggered for invitation: % (request_id: %)', NEW.id, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE LOG 'Failed to send Slack notification for invitation %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_user_invitation_created ON app_user_invitation;

CREATE TRIGGER on_user_invitation_created
  AFTER INSERT ON app_user_invitation
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_user_invitation();
