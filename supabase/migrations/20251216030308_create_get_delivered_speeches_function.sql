/*
  # Create function to get delivered speeches with timer data

  1. New Functions
    - `get_delivered_speeches(p_user_id uuid)`
      - Returns delivered speeches for a user
      - Includes timer report data (timing and qualification)
      - Joins app_meeting_roles_management with timer_reports
      - Filters for Prepared Speaker roles that are completed
  
  2. Returns
    - Role and speech details
    - Meeting information
    - Club name
    - Timer report data (actual time and qualification status)
*/

CREATE OR REPLACE FUNCTION get_delivered_speeches(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  meeting_date date,
  meeting_number text,
  club_name text,
  speech_title text,
  pathway_name text,
  pathway_level integer,
  project_title text,
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
    mr.speech_title,
    mr.pathway_name,
    mr.pathway_level,
    mr.project_title,
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
    AND tr.speech_category = 'prepared_speaker'
  WHERE mr.assigned_user_id = p_user_id
    AND mr.role_classification = 'Prepared Speaker'
    AND mr.is_completed = true
  ORDER BY mr.completed_at DESC;
$$;
