/*
  # Restore Table Topics Speaker Roles to Available Status

  1. Updates
    - Set all Table Topics Speaker roles to 'Available' status
    - Ensures all 12 Table Topics Speaker roles are accessible
    - Updates role_status from 'Deleted' to 'Available'

  2. Scope
    - Affects all meetings with Table Topics Speaker roles
    - Updates app_meeting_roles_management table
    - Preserves existing assignments and bookings

  3. Impact
    - Makes all Table Topics Speaker roles available for assignment
    - Allows unlimited participation in Table Topics sessions
    - Maintains existing role assignments
*/

-- Update all Table Topics Speaker roles to Available status
UPDATE app_meeting_roles_management 
SET 
  role_status = 'Available',
  updated_at = now()
WHERE 
  role_name LIKE 'Table Topics Speaker%'
  AND role_status = 'Deleted';

-- Also update any Table Topics Participant roles if they exist
UPDATE app_meeting_roles_management 
SET 
  role_status = 'Available',
  updated_at = now()
WHERE 
  role_name LIKE '%Table Topics%'
  AND role_name LIKE '%Participant%'
  AND role_status = 'Deleted';

-- Update max_participants for Table Topics roles to allow unlimited participation
UPDATE app_meeting_roles_management 
SET 
  max_participants = 999,
  updated_at = now()
WHERE 
  role_name LIKE 'Table Topics Speaker%'
  OR (role_name LIKE '%Table Topics%' AND role_name LIKE '%Participant%');

-- Also update the base role templates in app_meeting_roles if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_meeting_roles') THEN
    UPDATE app_meeting_roles 
    SET updated_at = now()
    WHERE meeting_role_name LIKE 'Table Topics Speaker%'
       OR (meeting_role_name LIKE '%Table Topics%' AND meeting_role_name LIKE '%Participant%');
  END IF;
END $$;