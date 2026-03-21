/*
  # Create functions to get different types of evaluations

  1. New Functions
    - `get_speech_evaluations(p_user_id uuid)` - Returns all speech evaluations
    - `get_table_topic_evaluations(p_user_id uuid)` - Returns all table topic evaluations
    - `get_master_evaluations(p_user_id uuid)` - Returns all master/general evaluations
  
  2. Returns
    - Meeting date, number, and club information
    - Role name and completion timestamp
    - Evaluatee information (who was evaluated)
*/

-- Function for Speech Evaluations
CREATE OR REPLACE FUNCTION get_speech_evaluations(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  meeting_date date,
  meeting_number text,
  club_name text,
  role_name text,
  completed_at timestamptz,
  evaluatee_name text
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
    COALESCE(aup.full_name, aup.email) as evaluatee_name
  FROM app_meeting_roles_management mr
  INNER JOIN app_club_meeting m ON m.id = mr.meeting_id
  INNER JOIN clubs c ON c.id = m.club_id
  LEFT JOIN app_meeting_roles_management speaker_role ON 
    speaker_role.meeting_id = mr.meeting_id 
    AND speaker_role.role_classification = 'Prepared Speaker'
    AND speaker_role.role_name SIMILAR TO '%[0-9]%'
    AND SUBSTRING(mr.role_name FROM '[0-9]+')::int = SUBSTRING(speaker_role.role_name FROM '[0-9]+')::int
  LEFT JOIN app_user_profiles aup ON aup.id = speaker_role.assigned_user_id
  WHERE mr.assigned_user_id = p_user_id
    AND mr.role_classification = 'Speech evaluvator'
    AND mr.is_completed = true
  ORDER BY mr.completed_at DESC;
$$;

-- Function for Table Topic Evaluations
CREATE OR REPLACE FUNCTION get_table_topic_evaluations(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  meeting_date date,
  meeting_number text,
  club_name text,
  role_name text,
  completed_at timestamptz
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
    mr.completed_at
  FROM app_meeting_roles_management mr
  INNER JOIN app_club_meeting m ON m.id = mr.meeting_id
  INNER JOIN clubs c ON c.id = m.club_id
  WHERE mr.assigned_user_id = p_user_id
    AND mr.role_classification = 'TT _ Evaluvator'
    AND mr.is_completed = true
  ORDER BY mr.completed_at DESC;
$$;

-- Function for Master Evaluations (General Evaluator)
CREATE OR REPLACE FUNCTION get_master_evaluations(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  meeting_date date,
  meeting_number text,
  club_name text,
  role_name text,
  completed_at timestamptz
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
    mr.completed_at
  FROM app_meeting_roles_management mr
  INNER JOIN app_club_meeting m ON m.id = mr.meeting_id
  INNER JOIN clubs c ON c.id = m.club_id
  WHERE mr.assigned_user_id = p_user_id
    AND mr.role_classification = 'Master evaluvator'
    AND mr.is_completed = true
  ORDER BY mr.completed_at DESC;
$$;
