/*
  # Fix Role Classification Constraint with Actual Database Values

  1. Changes
    - Drop existing constraint if it exists
    - Recreate constraint with actual values from database
    - Includes 'Keynote speakers' (plural, lowercase) as it exists in production
  
  2. Notes
    - Includes 'Speech evaluvator', 'Master evaluvator', 'TT _ Evaluvator' with 'u' spelling
    - Includes 'Keynote speakers' (plural) as it exists in current data
    - Frontend code has been updated to match these exact spellings
*/

-- Drop existing constraint if it exists
ALTER TABLE app_meeting_roles_management 
DROP CONSTRAINT IF EXISTS chk_app_meeting_roles_management_role_classification;

-- Recreate constraint with actual values from database
ALTER TABLE app_meeting_roles_management 
ADD CONSTRAINT chk_app_meeting_roles_management_role_classification 
CHECK (
  role_classification IS NULL OR role_classification IN (
    'Key Speakers',
    'Keynote speakers',
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