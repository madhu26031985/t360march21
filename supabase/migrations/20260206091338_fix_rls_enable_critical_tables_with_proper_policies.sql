/*
  # Fix RLS Issues - Enable Security on Critical Tables

  ## Problem
  RLS was disabled on critical tables causing security warnings. When enabled without proper policies, the app breaks because users can't access their own data.

  ## Changes

  1. Remove Unused Table
    - Drop `v_system_user_id` (empty, unused table)

  2. Fix app_club_user_relationship RLS
    - Add missing policy: Users can view their own club relationships
    - Enable RLS on the table
    - Existing policies already cover:
      * Club members viewing relationships within their club
      * ExComm adding/updating users
      * Users accepting invitations

  3. Fix Security Definer Views
    - Convert security definer views to regular views
    - These views don't need elevated privileges since they only join tables with proper RLS
    - Views: current_user_club_snapshots, ah_counter_reports_with_details, role_completion_summary

  ## Security Notes
  - Users MUST be able to see their own club memberships (critical for app functionality)
  - Club members can view other members in the same club
  - Only ExComm can modify relationships
  - RLS on joined tables in views will automatically filter data appropriately
*/

-- 1. Drop unused table
DROP TABLE IF EXISTS v_system_user_id CASCADE;

-- 2. Add critical missing policy for app_club_user_relationship
-- This allows users to see their own club memberships (essential for app to work)
CREATE POLICY "Users can view their own club relationships"
  ON app_club_user_relationship
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. Enable RLS on app_club_user_relationship
ALTER TABLE app_club_user_relationship ENABLE ROW LEVEL SECURITY;

-- 4. Recreate security definer views as regular views
-- These don't need elevated privileges since the underlying tables have proper RLS

-- Drop and recreate current_user_club_snapshots as regular view
DROP VIEW IF EXISTS current_user_club_snapshots;
CREATE VIEW current_user_club_snapshots AS
SELECT 
  aas.id,
  aas.user_id,
  aas.club_id,
  aas.snapshot_date,
  aas.user_full_name,
  aas.user_email,
  aas.user_role,
  aas.is_authenticated,
  aas.first_seen_at,
  aas.last_seen_at,
  aas.total_duration_minutes,
  aas.role_changes_count,
  aas.final_role,
  aas.created_at,
  aas.updated_at,
  c.name AS club_name,
  c.club_number
FROM app_attendance_snapshot aas
JOIN clubs c ON c.id = aas.club_id
WHERE aas.snapshot_date = CURRENT_DATE 
  AND aas.is_authenticated = true;

-- Drop and recreate ah_counter_reports_with_details as regular view
DROP VIEW IF EXISTS ah_counter_reports_with_details;
CREATE VIEW ah_counter_reports_with_details AS
SELECT 
  acr.id,
  acr.meeting_id,
  acr.club_id,
  acr.meeting_date,
  acr.meeting_number,
  acr.speaker_name,
  acr.speaker_user_id,
  acr.um_count,
  acr.uh_count,
  acr.ah_count,
  acr.er_count,
  acr.hmm_count,
  acr.like_count,
  acr.so_count,
  acr.well_count,
  acr.okay_count,
  acr.you_know_count,
  acr.repeated_words,
  acr.comments,
  acr.recorded_by,
  acr.recorded_at,
  acr.created_at,
  acr.updated_at,
  m.meeting_title,
  m.meeting_mode,
  m.meeting_start_time,
  m.meeting_end_time,
  c.name AS club_name,
  c.club_number,
  sp.full_name AS speaker_full_name,
  sp.email AS speaker_email,
  rec.full_name AS recorded_by_name,
  rec.email AS recorded_by_email,
  (acr.um_count + acr.uh_count + acr.ah_count + acr.er_count + 
   acr.hmm_count + acr.like_count + acr.so_count + acr.well_count + 
   acr.okay_count + acr.you_know_count) AS total_filler_words
FROM ah_counter_reports acr
LEFT JOIN app_club_meeting m ON acr.meeting_id = m.id
LEFT JOIN clubs c ON acr.club_id = c.id
LEFT JOIN app_user_profiles sp ON acr.speaker_user_id = sp.id
LEFT JOIN app_user_profiles rec ON acr.recorded_by = rec.id;

-- Drop and recreate role_completion_summary as regular view
DROP VIEW IF EXISTS role_completion_summary;
CREATE VIEW role_completion_summary AS
SELECT 
  m.meeting_date,
  m.meeting_title,
  c.name AS club_name,
  r.role_name,
  r.role_classification,
  aup.full_name AS assigned_user,
  r.booking_status,
  r.is_completed,
  r.completed_at,
  r.completion_notes
FROM app_meeting_roles_management r
JOIN app_club_meeting m ON r.meeting_id = m.id
JOIN clubs c ON r.club_id = c.id
LEFT JOIN app_user_profiles aup ON r.assigned_user_id = aup.id
WHERE r.assigned_user_id IS NOT NULL
ORDER BY m.meeting_date DESC, r.role_classification, r.role_name;
