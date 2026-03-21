/*
  # Update get_table_topics_delivered function to include question

  ## Summary
  Updates the get_table_topics_delivered function to return the table topic question
  assigned by the Table Topics Master.

  ## Changes
  1. Updated Function
    - Drops and recreates the function with updated signature
    - Added `table_topic_question` to the return columns
    - No changes to filtering or ordering logic
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_table_topics_delivered(uuid);

-- Recreate with updated signature
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
  table_topic_question text
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
    mr.table_topic_question
  FROM app_meeting_roles_management mr
  INNER JOIN app_club_meeting m ON m.id = mr.meeting_id
  INNER JOIN clubs c ON c.id = m.club_id
  LEFT JOIN timer_reports tr ON 
    tr.speaker_user_id = mr.assigned_user_id 
    AND tr.meeting_id = mr.meeting_id
    AND tr.speech_category = 'table_topic_speaker'
  WHERE mr.assigned_user_id = p_user_id
    AND mr.role_classification = 'On-the-Spot Speaking'
    AND mr.is_completed = true
  ORDER BY mr.completed_at DESC;
$$;
