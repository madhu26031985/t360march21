/*
  # Create functions to get different types of completed roles

  1. New Functions
    - `get_club_speaker_roles(p_user_id uuid)` - Returns all club speaker roles
    - `get_tag_roles(p_user_id uuid)` - Returns all tag roles (Timer, Grammarian, Ah Counter)
    - `get_ancillary_roles(p_user_id uuid)` - Returns all ancillary/key speaker roles
  
  2. Returns
    - Meeting date, number, and club information
    - Role name and completion timestamp
*/

-- Function for Club Speaker Roles
CREATE OR REPLACE FUNCTION get_club_speaker_roles(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  meeting_date date,
  meeting_number text,
  club_name text,
  role_name text,
  role_classification text,
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
    mr.role_classification,
    mr.completed_at
  FROM app_meeting_roles_management mr
  INNER JOIN app_club_meeting m ON m.id = mr.meeting_id
  INNER JOIN clubs c ON c.id = m.club_id
  WHERE mr.assigned_user_id = p_user_id
    AND mr.role_classification = 'Club Speakers'
    AND mr.is_completed = true
  ORDER BY mr.completed_at DESC;
$$;

-- Function for Tag Roles
CREATE OR REPLACE FUNCTION get_tag_roles(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  meeting_date date,
  meeting_number text,
  club_name text,
  role_name text,
  role_classification text,
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
    mr.role_classification,
    mr.completed_at
  FROM app_meeting_roles_management mr
  INNER JOIN app_club_meeting m ON m.id = mr.meeting_id
  INNER JOIN clubs c ON c.id = m.club_id
  WHERE mr.assigned_user_id = p_user_id
    AND mr.role_classification = 'Tag roles'
    AND mr.is_completed = true
  ORDER BY mr.completed_at DESC;
$$;

-- Function for Ancillary/Key Speaker Roles
CREATE OR REPLACE FUNCTION get_ancillary_roles(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  meeting_date date,
  meeting_number text,
  club_name text,
  role_name text,
  role_classification text,
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
    mr.role_classification,
    mr.completed_at
  FROM app_meeting_roles_management mr
  INNER JOIN app_club_meeting m ON m.id = mr.meeting_id
  INNER JOIN clubs c ON c.id = m.club_id
  WHERE mr.assigned_user_id = p_user_id
    AND mr.role_classification IN ('Key Speakers', 'Educational speaker')
    AND mr.is_completed = true
  ORDER BY mr.completed_at DESC;
$$;
