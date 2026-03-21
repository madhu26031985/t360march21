/*
  # Fix get_delivered_speeches to use pathway data

  1. Changes
    - Updates the function to pull speech details from app_evaluation_pathway
    - Speech title, pathway name, level, and project title now come from pathway table
    - Evaluator name also comes from pathway table
  
  2. Returns
    - All fields with accurate data from the evaluation pathway corner
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
    ep.speech_title,
    ep.pathway_name,
    ep.level as pathway_level,
    ep.project_name as project_title,
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
