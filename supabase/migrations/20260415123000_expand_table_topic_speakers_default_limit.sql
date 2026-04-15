/*
  # Expand Table Topic Speaker default availability to 12

  1. Purpose
    - Keep Table Topic Speaker roles 1..12 available by default in new meetings
    - Prevent generic speaker limit (3) from hiding Table Topic Speaker slots

  2. Changes
    - Replaces limit_default_meeting_roles() with explicit Table Topic Speaker limit of 12
    - Backfills existing meeting-role rows so Table Topic Speaker 1..12 are Available
*/

CREATE OR REPLACE FUNCTION limit_default_meeting_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.role_status := 'Available';

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

    -- Evaluator roles (not Master Evaluator): Only first 6 available.
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

    -- Master Evaluator roles: Only first 2 available.
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

    -- Table Topic Evaluator roles: Only first 3 available.
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

-- Backfill: restore Table Topic Speaker slots 1..12 for existing meeting roles.
UPDATE app_meeting_roles_management
SET role_status = 'Available',
    updated_at = now()
WHERE role_status = 'Deleted'
  AND (role_name ILIKE '%table topic%speaker%' OR role_name ILIKE '%tt%speaker%')
  AND role_name ~ '\d+$'
  AND CAST(regexp_replace(role_name, '.*?(\d+)$', '\1') AS INTEGER) <= 12;
