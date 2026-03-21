/*
  # Add Keynote Speaker Classification

  1. Changes
    - Drop existing role classification constraint
    - Recreate constraint to include 'Keynote speaker'
  
  2. Security
    - No security changes
*/

-- Drop existing constraint
ALTER TABLE app_meeting_roles_management
DROP CONSTRAINT IF EXISTS chk_app_meeting_roles_management_role_classification;

-- Add constraint with Keynote speaker included
ALTER TABLE app_meeting_roles_management
ADD CONSTRAINT chk_app_meeting_roles_management_role_classification
CHECK (
  role_classification IS NULL OR 
  role_classification = ANY (ARRAY[
    'Key Speakers',
    'Keynote speaker',
    'Prepared Speaker',
    'Club Speakers',
    'Educational speaker',
    'Speech evaluvator',
    'Master evaluvator',
    'TT _ Evaluvator',
    'On-the-Spot Speaking',
    'Tag roles',
    'Ancillary Speaker',
    'Judge'
  ])
);