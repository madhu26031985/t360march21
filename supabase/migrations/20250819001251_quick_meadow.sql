/*
  # Limit Evaluator Roles to 3

  1. Function Updates
    - Updates auto_populate_meeting_roles() function
    - Limits evaluator roles to only Evaluator 1, 2, and 3
    - Excludes Evaluator 4, 5, and 6 from auto-creation

  2. Role Management
    - Only creates first 3 evaluator roles
    - Maintains all other role types unchanged
    - Proper order_index assignment
*/

-- Update the auto_populate_meeting_roles function to limit evaluators to 3
CREATE OR REPLACE FUNCTION auto_populate_meeting_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert meeting roles from app_meeting_roles, excluding Evaluator 4, 5, and 6
  INSERT INTO app_meeting_roles_management (
    meeting_id,
    role_id,
    role_name,
    role_metric,
    assigned_user_id,
    is_required,
    max_participants,
    order_index,
    created_at,
    updated_at,
    booking_status,
    role_status,
    club_id
  )
  SELECT 
    NEW.id,
    amr.id,
    amr.meeting_role_name,
    amr.meeting_role_metric,
    NULL,
    FALSE,
    1,
    ROW_NUMBER() OVER (ORDER BY amr.id) - 1,
    NOW(),
    NOW(),
    'open',
    'Available',
    NEW.club_id
  FROM app_meeting_roles amr
  WHERE amr.meeting_role_name NOT LIKE 'Evaluator 4%'
    AND amr.meeting_role_name NOT LIKE 'Evaluator 5%'
    AND amr.meeting_role_name NOT LIKE 'Evaluator 6%'
  ORDER BY amr.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;