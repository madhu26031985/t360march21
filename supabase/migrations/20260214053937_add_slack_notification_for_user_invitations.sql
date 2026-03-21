/*
  # Add Slack Notification for User Invitations

  1. Changes
    - Creates a database trigger on app_user_invitation table
    - Automatically sends Slack notification when a new invitation is created
    - Uses the notify-slack-user-invitation edge function

  2. Security
    - Function runs with SECURITY DEFINER privileges to bypass RLS
    - Only triggers on INSERT operations for new invitations
*/

-- Create function to notify Slack when a new invitation is created
CREATE OR REPLACE FUNCTION notify_slack_on_user_invitation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  supabase_url text := current_setting('app.settings.supabase_url', true);
  supabase_anon_key text := current_setting('app.settings.supabase_anon_key', true);
BEGIN
  -- Only proceed if Supabase URL and anon key are configured
  IF supabase_url IS NOT NULL AND supabase_anon_key IS NOT NULL THEN
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
  ELSE
    RAISE LOG 'Supabase URL or anon key not configured, skipping Slack notification';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new invitations
DROP TRIGGER IF EXISTS on_user_invitation_created ON app_user_invitation;

CREATE TRIGGER on_user_invitation_created
  AFTER INSERT ON app_user_invitation
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_user_invitation();
