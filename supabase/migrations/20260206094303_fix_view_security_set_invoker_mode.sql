/*
  # Fix View Security - Set Security Invoker Mode

  ## Problem
  The three views (ah_counter_reports_with_details, role_completion_summary, current_user_club_snapshots) 
  are still marked as SECURITY DEFINER in Supabase Security Advisor.
  
  In PostgreSQL, views are SECURITY DEFINER by default. We need to explicitly set them to SECURITY INVOKER
  so they run with the permissions of the querying user, not the view creator.

  ## Solution
  Use ALTER VIEW to set security_invoker = true on all three views.
  
  ## Security Impact
  After this change:
  - Views will execute with the calling user's permissions (SECURITY INVOKER)
  - Row Level Security policies on underlying tables will be properly enforced
  - No elevation of privileges through views
  - Supabase Security Advisor warnings will be resolved
*/

-- Set security_invoker = true on all three views
-- This makes them run with the permissions of the querying user, not the view creator

ALTER VIEW ah_counter_reports_with_details 
  SET (security_invoker = true);

ALTER VIEW role_completion_summary 
  SET (security_invoker = true);

ALTER VIEW current_user_club_snapshots 
  SET (security_invoker = true);
