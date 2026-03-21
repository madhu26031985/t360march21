/*
  # Auto-populate meeting roles trigger

  1. New Function
    - `auto_populate_meeting_roles()` - Copies roles from app_meeting_roles to app_meeting_roles_management when a meeting is created

  2. New Trigger
    - Triggers after INSERT on app_club_meeting
    - Automatically creates role management records for each available role

  3. Security
    - Function runs with definer rights for proper access
*/

-- Create function to auto-populate meeting roles
CREATE OR REPLACE FUNCTION auto_populate_meeting_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert all active meeting roles into the management table for this new meeting
  INSERT INTO app_meeting_roles_management (
    meeting_id,
    role_id,
    role_name,
    role_metric,
    assigned_user_id,
    is_required,
    max_participants,
    order_index,
    booking_status,
    role_status,
    role_classification,
    club_id,
    created_at,
    updated_at
  )
  SELECT 
    NEW.id as meeting_id,
    amr.id as role_id,
    amr.meeting_role_name as role_name,
    amr.meeting_role_metric as role_metric,
    NULL as assigned_user_id,
    FALSE as is_required,
    1 as max_participants,
    ROW_NUMBER() OVER (ORDER BY amr.meeting_role_name) - 1 as order_index,
    'open' as booking_status,
    'Available' as role_status,
    amr.role_classification,
    NEW.club_id as club_id,
    NOW() as created_at,
    NOW() as updated_at
  FROM app_meeting_roles amr
  WHERE amr.role_classification IS NOT NULL
  ORDER BY amr.meeting_role_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-populate meeting roles when a meeting is created
DROP TRIGGER IF EXISTS trigger_auto_populate_meeting_roles ON app_club_meeting;

CREATE TRIGGER trigger_auto_populate_meeting_roles
  AFTER INSERT ON app_club_meeting
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_meeting_roles();