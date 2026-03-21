/*
  # Fix Daily User Stats Cron Job Configuration
  
  1. Purpose
    - Update the cron job to use proper Supabase HTTP extensions
    - Ensure the job can successfully call the edge function
  
  2. Changes
    - Drop existing cron job
    - Recreate with proper pg_net HTTP request
    - Use Supabase's built-in net.http_post function
*/

-- Drop existing job if it exists
SELECT cron.unschedule('daily-user-stats-report');

-- Enable http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http;

-- Recreate cron job with simplified HTTP call
-- Note: The edge function URL and auth are handled by Supabase automatically
SELECT cron.schedule(
  'daily-user-stats-report',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := concat(
      current_setting('app.settings.supabase_url', true),
      '/functions/v1/daily-user-stats'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', concat('Bearer ', current_setting('app.settings.service_role_key', true))
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);
