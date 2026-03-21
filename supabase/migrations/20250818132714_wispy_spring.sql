/*
  # Limit Default Available Meeting Roles

  1. Purpose
     - When a meeting is created, only show essential roles as "Available"
     - Set excess roles to "Deleted" status by default
     - ExComm can manually make additional roles available if needed

  2. Role Limits
     - Speaker roles: Only first 3 available (Speaker 1, Speaker 2, Speaker 3)
     - Chief Judge roles: Only first 3 available
     - Evaluator roles: Only first 6 available
     - Master Evaluator roles: Only first 2 available
     - Table Topic Evaluator roles: Only first 3 available

  3. Implementation
     - Update trigger function to set role_status based on role patterns
     - Roles beyond the limit automatically set to "Deleted"
     - Maintains existing functionality for manual role management
*/

-- Create or replace the function to limit default meeting roles
CREATE OR REPLACE FUNCTION limit_default_meeting_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Only apply limits when inserting new meeting roles
  IF TG_OP = 'INSERT' THEN
    -- Initialize role_status as 'Available' by default
    NEW.role_status := 'Available';
    
    -- Apply limits based on role patterns
    
    -- Speaker roles: Only first 3 available (Speaker 1, Speaker 2, Speaker 3)
    IF NEW.role_name ILIKE '%speaker%' AND NEW.role_name ~ '\d+$' THEN
      -- Extract number from role name (e.g., "Speaker 4" -> 4)
      DECLARE
        role_number INTEGER;
      BEGIN
        role_number := CAST(regexp_replace(NEW.role_name, '.*?(\d+)$', '\1') AS INTEGER);
        IF role_number > 3 THEN
          NEW.role_status := 'Deleted';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- If we can't extract number, keep as Available
          NULL;
      END;
    END IF;
    
    -- Chief Judge roles: Only first 3 available
    IF NEW.role_name ILIKE '%chief judge%' AND NEW.role_name ~ '\d+$' THEN
      DECLARE
        role_number INTEGER;
      BEGIN
        role_number := CAST(regexp_replace(NEW.role_name, '.*?(\d+)$', '\1') AS INTEGER);
        IF role_number > 3 THEN
          NEW.role_status := 'Deleted';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;
    
    -- Evaluator roles (not Master Evaluator): Only first 6 available
    IF NEW.role_name ILIKE '%evaluator%' 
       AND NOT NEW.role_name ILIKE '%master evaluator%'
       AND NOT NEW.role_name ILIKE '%table topic%evaluator%'
       AND NEW.role_name ~ '\d+$' THEN
      DECLARE
        role_number INTEGER;
      BEGIN
        role_number := CAST(regexp_replace(NEW.role_name, '.*?(\d+)$', '\1') AS INTEGER);
        IF role_number > 6 THEN
          NEW.role_status := 'Deleted';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;
    
    -- Master Evaluator roles: Only first 2 available
    IF NEW.role_name ILIKE '%master evaluator%' AND NEW.role_name ~ '\d+$' THEN
      DECLARE
        role_number INTEGER;
      BEGIN
        role_number := CAST(regexp_replace(NEW.role_name, '.*?(\d+)$', '\1') AS INTEGER);
        IF role_number > 2 THEN
          NEW.role_status := 'Deleted';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;
    
    -- Table Topic Evaluator roles: Only first 3 available
    IF (NEW.role_name ILIKE '%table topic%evaluator%' OR NEW.role_name ILIKE '%tt%evaluator%') 
       AND NEW.role_name ~ '\d+$' THEN
      DECLARE
        role_number INTEGER;
      BEGIN
        role_number := CAST(regexp_replace(NEW.role_name, '.*?(\d+)$', '\1') AS INTEGER);
        IF role_number > 3 THEN
          NEW.role_status := 'Deleted';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to apply role limits when inserting meeting roles
DROP TRIGGER IF EXISTS trigger_limit_default_meeting_roles ON app_meeting_roles_management;

CREATE TRIGGER trigger_limit_default_meeting_roles
  BEFORE INSERT ON app_meeting_roles_management
  FOR EACH ROW
  EXECUTE FUNCTION limit_default_meeting_roles();

-- Update existing meeting roles to apply the new limits
-- This will clean up any existing meetings that have too many available roles

UPDATE app_meeting_roles_management 
SET role_status = 'Deleted', updated_at = now()
WHERE role_status = 'Available' 
  AND (
    -- Speaker roles beyond 3
    (role_name ILIKE '%speaker%' AND role_name ~ '\d+$' 
     AND CAST(regexp_replace(role_name, '.*?(\d+)$', '\1') AS INTEGER) > 3)
    OR
    -- Chief Judge roles beyond 3  
    (role_name ILIKE '%chief judge%' AND role_name ~ '\d+$'
     AND CAST(regexp_replace(role_name, '.*?(\d+)$', '\1') AS INTEGER) > 3)
    OR
    -- Regular Evaluator roles beyond 6 (excluding Master and TT Evaluators)
    (role_name ILIKE '%evaluator%' 
     AND NOT role_name ILIKE '%master evaluator%'
     AND NOT role_name ILIKE '%table topic%evaluator%'
     AND role_name ~ '\d+$'
     AND CAST(regexp_replace(role_name, '.*?(\d+)$', '\1') AS INTEGER) > 6)
    OR
    -- Master Evaluator roles beyond 2
    (role_name ILIKE '%master evaluator%' AND role_name ~ '\d+$'
     AND CAST(regexp_replace(role_name, '.*?(\d+)$', '\1') AS INTEGER) > 2)
    OR
    -- Table Topic Evaluator roles beyond 3
    ((role_name ILIKE '%table topic%evaluator%' OR role_name ILIKE '%tt%evaluator%') 
     AND role_name ~ '\d+$'
     AND CAST(regexp_replace(role_name, '.*?(\d+)$', '\1') AS INTEGER) > 3)
  );