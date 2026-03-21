/*
  # Update get_delivered_speeches to include evaluator name

  1. Changes
    - Drops and recreates the `get_delivered_speeches` function
    - Adds evaluator_name to the return columns
    - Joins with app_evaluation_pathway to get the assigned evaluator
    - Joins with app_user_profiles to get the evaluator's full name
  
  2. Returns
    - All previous fields plus evaluator_name from pathway data
*/

DROP FUNCTION IF EXISTS get_delivered_speeches(uuid);

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
  time_qualification boolean,
  evaluator_name text
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
    tr.time_qualification,
    evaluator.full_name as evaluator_name
  FROM app_meeting_roles_management mr
  INNER JOIN app_club_meeting m ON m.id = mr.meeting_id
  INNER JOIN clubs c ON c.id = m.club_id
  LEFT JOIN timer_reports tr ON 
    tr.speaker_user_id = mr.assigned_user_id 
    AND tr.meeting_id = mr.meeting_id
    AND tr.speech_category = 'prepared_speaker'
  LEFT JOIN app_evaluation_pathway ep ON 
    ep.user_id = mr.assigned_user_id
    AND ep.meeting_id = mr.meeting_id
  LEFT JOIN app_user_profiles evaluator ON evaluator.id = ep.assigned_evaluator_id
  WHERE mr.assigned_user_id = p_user_id
    AND mr.role_classification = 'Prepared Speaker'
    AND mr.is_completed = true
  ORDER BY mr.completed_at DESC;
$$;
