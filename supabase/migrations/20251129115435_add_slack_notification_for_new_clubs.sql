/*
  # Add Slack Notification for New Club Creation
  
  ## Overview
  This migration sets up automatic Slack notifications whenever a new club 
  is created in the club_profiles table.
  
  ## Implementation
  1. Creates a function that calls the Slack notification edge function
  2. Creates a trigger that fires after new club profile insertion
  3. Uses Supabase's pg_net extension to make HTTP requests
  
  ## How It Works
  - When a new row is inserted into club_profiles
  - Trigger fires and calls the edge function
  - Edge function fetches club details and creator information
  - Sends formatted message to Slack webhook
  - Message includes: club name, number, location, type, meeting type, creator info
  
  ## Security
  - Function runs as SECURITY DEFINER for access to pg_net
  - Edge function is public (verify_jwt = false) to allow database calls
  - Slack webhook URL is hardcoded in the edge function
*/

-- Create function to notify Slack about new clubs
CREATE OR REPLACE FUNCTION notify_slack_new_club()
RETURNS TRIGGER AS $$
DECLARE
  v_request_id bigint;
  v_function_url text;
BEGIN
  -- Construct the edge function URL
  v_function_url := 'https://chtkcretrpygqmwtyonx.supabase.co/functions/v1/notify-slack-new-club';
  
  -- Call the edge function asynchronously
  SELECT INTO v_request_id net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodGtjcmV0cnB5Z3Ftd3R5b254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODkxMzAsImV4cCI6MjA2NjU2NTEzMH0.RzEPVTh22ZJrq5tnSHK5PQCLXRb5YUNU16EyDFk_ntU'
    ),
    body := jsonb_build_object(
      'record', row_to_json(NEW)
    )
  );
  
  -- Log the request ID for debugging
  RAISE LOG 'Slack club notification request ID: %', v_request_id;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'Failed to send Slack club notification: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_new_club_notify_slack ON club_profiles;

-- Create trigger for new club insertions
CREATE TRIGGER on_new_club_notify_slack
  AFTER INSERT ON club_profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_new_club();

-- Add comment for documentation
COMMENT ON FUNCTION notify_slack_new_club() IS 
  'Sends a Slack notification via edge function when a new club is created';
