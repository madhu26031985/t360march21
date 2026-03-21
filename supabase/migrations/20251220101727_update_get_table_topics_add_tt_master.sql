/*
  # Update get_table_topics_delivered to include Table Topics Master name

  ## Summary
  Updates the get_table_topics_delivered function to return the name of the
  Table Topics Master who conducted the session.

  ## Changes
  1. Updated Function
    - Added `table_topics_master_name` to return columns
    - Joins with meeting roles to find the Table Topics Master for each meeting
    - Returns the full name of the assigned TT Master
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_table_topics_delivered(uuid);

-- Recreate with Table Topics Master name
CREATE OR REPLACE FUNCTION get_table_topics_delivered(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  meeting_date date,
  meeting_number text,
  club_name text,
  role_name text,
  completed_at timestamptz,
  actual_time_display text,
  time_qualification boolean,
  table_topic_question text,
  table_topics_master_name text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    mr.id,
    m.meeting_date,
    m.meeting_number,
    c.name as club_name,
    mr.role_name,
    mr.completed_at,
    tr.actual_time_display,
    tr.time_qualification,
    mr.table_topic_question,
    tt_master.full_name as table_topics_master_name
  FROM app_meeting_roles_management mr
  INNER JOIN app_club_meeting m ON m.id = mr.meeting_id
  INNER JOIN clubs c ON c.id = m.club_id
  LEFT JOIN timer_reports tr ON 
    tr.speaker_user_id = mr.assigned_user_id 
    AND tr.meeting_id = mr.meeting_id
    AND tr.speech_category = 'table_topic_speaker'
  LEFT JOIN app_meeting_roles_management tt_master_role ON 
    tt_master_role.meeting_id = mr.meeting_id
    AND tt_master_role.role_name = 'Table Topics Master'
  LEFT JOIN app_user_profiles tt_master ON tt_master.id = tt_master_role.assigned_user_id
  WHERE mr.assigned_user_id = p_user_id
    AND mr.role_classification = 'On-the-Spot Speaking'
    AND mr.is_completed = true
  ORDER BY mr.completed_at DESC;
$$;
