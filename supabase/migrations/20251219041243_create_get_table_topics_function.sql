/*
  # Create function to get table topics delivered

  1. New Function
    - `get_table_topics_delivered(p_user_id uuid)` - Returns all table topics sessions for a user
    - Includes meeting details, club info, timing, and qualification status
  
  2. Returns
    - Meeting date, number, and club information
    - Role name and completion timestamp
    - Timer data (actual time and qualification status)
*/

CREATE OR REPLACE FUNCTION get_table_topics_delivered(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  meeting_date date,
  meeting_number text,
  club_name text,
  role_name text,
  completed_at timestamptz,
  actual_time_display text,
  time_qualification boolean
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
    tr.time_qualification
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
