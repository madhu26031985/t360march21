/*
  # Default TT Evaluator and Master Evaluator to Deleted

  1. Purpose
    - Keep all Master Evaluator roles as Deleted by default on new meeting creation
    - Keep all Table Topic Evaluator roles as Deleted by default on new meeting creation
    - Preserve existing default availability behavior for other role groups

  2. Notes
    - Table Topic Speaker roles remain available up to 12 slots.
*/

CREATE OR REPLACE FUNCTION limit_default_meeting_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.role_status := 'Available';

    -- Keep all Master Evaluator roles deleted by default.
    IF NEW.role_name ILIKE '%master evaluator%' THEN
      NEW.role_status := 'Deleted';
    END IF;

    -- Keep all Table Topic Evaluator roles deleted by default.
    IF NEW.role_name ILIKE '%table topic%evaluator%' OR NEW.role_name ILIKE '%tt%evaluator%' THEN
      NEW.role_status := 'Deleted';
    END IF;

    -- Table Topic Speaker roles: keep first 12 available.
    IF (NEW.role_name ILIKE '%table topic%speaker%' OR NEW.role_name ILIKE '%tt%speaker%')
       AND NEW.role_name ~ '\d+$' THEN
      DECLARE
        role_number INTEGER;
      BEGIN
        role_number := CAST(regexp_replace(NEW.role_name, '.*?(\d+)$', '\1') AS INTEGER);
        IF role_number > 12 THEN
          NEW.role_status := 'Deleted';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;

    -- Speaker roles: Only first 3 available, excluding Table Topic Speaker variants.
    IF NEW.role_name ILIKE '%speaker%'
       AND NEW.role_name !~* 'table topic.*speaker'
       AND NEW.role_name !~* 'tt.*speaker'
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

    -- Chief Judge roles: Only first 3 available.
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

    -- Evaluator roles (not Master Evaluator / TT Evaluator): Only first 6 available.
    IF NEW.role_name ILIKE '%evaluator%'
       AND NOT NEW.role_name ILIKE '%master evaluator%'
       AND NOT NEW.role_name ILIKE '%table topic%evaluator%'
       AND NOT NEW.role_name ILIKE '%tt%evaluator%'
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing rows so these roles are hidden by default behavior.
UPDATE app_meeting_roles_management
SET role_status = 'Deleted',
    updated_at = now()
WHERE role_name ILIKE '%master evaluator%'
   OR role_name ILIKE '%table topic%evaluator%'
   OR role_name ILIKE '%tt%evaluator%';
