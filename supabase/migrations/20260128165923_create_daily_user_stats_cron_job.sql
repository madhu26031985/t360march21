/*
  # Create Daily User Stats Cron Job
  
  1. Purpose
    - Schedule daily Slack notifications with user statistics
    - Reports total users, users with clubs, total clubs, and new users today
    - Runs every day at 9:00 AM IST (3:30 AM UTC)
  
  2. What it does
    - Enables pg_cron extension for scheduled jobs
    - Creates a cron job that calls the daily-user-stats edge function
    - Sends comprehensive user/club statistics to Slack
  
  3. Schedule
    - Daily at 9:00 AM IST (3:30 AM UTC)
    - Cron expression: '30 3 * * *'
  
  4. Statistics Reported
    - Total registered users
    - Users who have joined clubs
    - Total clubs in system
    - New users registered today
    - Conversion rate (users with clubs / total users)
*/

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create daily cron job to send user stats to Slack at 9:00 AM IST (3:30 AM UTC)
SELECT cron.schedule(
  'daily-user-stats-report',
  '30 3 * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT CONCAT(current_setting('app.settings.api_url'), '/functions/v1/daily-user-stats')),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := jsonb_build_object('scheduled', true)
    );
  $$
);
