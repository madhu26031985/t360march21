/*
  # Delete Chief Judge Roles in Meeting Roles Management

  1. Updates
    - Set `role_status` to 'Deleted' for all Chief Judge roles
    - Update `updated_at` timestamp for audit trail
    - Preserve all other role data for historical records

  2. Safety
    - Only affects roles with names starting with "Chief Judge"
    - Soft delete approach - data preserved but marked as deleted
    - All other roles remain unaffected
*/

-- Update all Chief Judge roles to 'Deleted' status
UPDATE app_meeting_roles_management 
SET 
  role_status = 'Deleted',
  updated_at = now()
WHERE 
  role_name ILIKE 'Chief Judge%';

-- Verification query (commented out)
-- SELECT role_name, role_status, updated_at 
-- FROM app_meeting_roles_management 
-- WHERE role_name ILIKE 'Chief Judge%'
-- ORDER BY role_name;