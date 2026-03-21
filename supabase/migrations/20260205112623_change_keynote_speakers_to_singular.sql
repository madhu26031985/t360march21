/*
  # Change Keynote Speakers to Keynote Speaker (Singular)

  ## Summary
  Updates all references of "Keynote speakers" (plural) to "Keynote Speaker" (singular) 
  for consistency across the application.

  ## Changes
  1. Drop existing constraints temporarily
  2. Update all data to use singular form
  3. Add new constraint with singular form including all existing classifications

  ## Notes
  - This ensures consistency between the UI and database
  - Affects existing meeting roles with "Keynote speakers" classification
*/

-- Step 1: Drop both existing constraints to allow data updates
ALTER TABLE app_meeting_roles_management 
DROP CONSTRAINT IF EXISTS app_meeting_roles_management_role_classification_check;

ALTER TABLE app_meeting_roles_management 
DROP CONSTRAINT IF EXISTS chk_app_meeting_roles_management_role_classification;

-- Step 2: Update existing roles with "Keynote speakers" to "Keynote Speaker"
UPDATE app_meeting_roles_management 
SET role_name = 'Keynote Speaker'
WHERE role_name = 'Keynote speakers';

-- Step 3: Update role_classification in app_meeting_roles_management
UPDATE app_meeting_roles_management 
SET role_classification = 'Keynote Speaker'
WHERE role_classification = 'Keynote speakers';

-- Step 4: Add updated constraint with all existing role_classifications
ALTER TABLE app_meeting_roles_management
ADD CONSTRAINT chk_app_meeting_roles_management_role_classification
CHECK (role_classification = ANY (ARRAY[
  'Toastmaster of the Day'::text,
  'General Evaluator'::text,
  'Table Topics Master'::text,
  'Timer'::text,
  'Ah-Counter'::text,
  'Grammarian'::text,
  'Key Speakers'::text,
  'Prepared Speaker'::text,
  'Speech evaluvator'::text,
  'Functionary Roles'::text,
  'Tag Roles'::text,
  'Tag roles'::text,
  'Educational speaker'::text,
  'Club Speakers'::text,
  'On-the-Spot Speaking'::text,
  'Master Evaluator'::text,
  'Master evaluvator'::text,
  'Ancillary Speaker'::text,
  'Keynote Speaker'::text,
  'Ice Breaker'::text,
  'TT _ Evaluvator'::text
]));

-- Add comment for documentation
COMMENT ON CONSTRAINT chk_app_meeting_roles_management_role_classification 
ON app_meeting_roles_management IS 
  'Updated to use singular "Keynote Speaker" for consistency. Includes all existing role classifications.';
