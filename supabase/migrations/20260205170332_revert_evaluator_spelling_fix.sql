/*
  # Revert Evaluator Spelling Changes

  ## Summary
  This migration reverts the evaluator spelling changes to fix meeting creation errors.
  The auto_populate_meeting_roles trigger is inserting roles with the old spelling,
  causing constraint violations.

  ## Changes
  1. Drop current constraint
  2. Update existing data back to old spelling
  3. Recreate constraint with original values (including typos)

  ## Affected Values
  - 'Speech Evaluator' → 'Speech evaluvator'
  - 'Master Evaluator' → 'Master evaluvator'
  - 'TT Evaluator' → 'TT _ Evaluvator'
*/

-- Drop the current constraint
ALTER TABLE app_meeting_roles_management
DROP CONSTRAINT IF EXISTS chk_app_meeting_roles_management_role_classification;

-- Update existing data back to old spelling to match what triggers expect
UPDATE app_meeting_roles_management
SET role_classification = 'Speech evaluvator'
WHERE role_classification = 'Speech Evaluator';

UPDATE app_meeting_roles_management
SET role_classification = 'Master evaluvator'
WHERE role_classification = 'Master Evaluator';

UPDATE app_meeting_roles_management
SET role_classification = 'TT _ Evaluvator'
WHERE role_classification = 'TT Evaluator';

-- Recreate constraint with original values (including the typos)
ALTER TABLE app_meeting_roles_management 
ADD CONSTRAINT chk_app_meeting_roles_management_role_classification 
CHECK (
  role_classification IS NULL OR role_classification IN (
    'Key Speakers',
    'Keynote Speaker',
    'Prepared Speaker',
    'Club Speakers',
    'Educational speaker',
    'Speech evaluvator',
    'Master evaluvator',
    'TT _ Evaluvator',
    'On-the-Spot Speaking',
    'Tag roles',
    'Ancillary Speaker',
    'Judge',
    'Ice Breaker'
  )
);