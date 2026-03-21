/*
  # Fix Keynote Speaker Classification - Add Plural Form

  1. Changes
    - Update role classification constraint to include both "Keynote speaker" and "Keynote speakers"
  
  2. Security
    - No security changes
*/

-- Drop existing constraint
ALTER TABLE app_meeting_roles_management
DROP CONSTRAINT IF EXISTS chk_app_meeting_roles_management_role_classification;

-- Add constraint with both singular and plural forms
ALTER TABLE app_meeting_roles_management
ADD CONSTRAINT chk_app_meeting_roles_management_role_classification
CHECK (
  role_classification IS NULL OR 
  role_classification = ANY (ARRAY[
    'Key Speakers',
    'Keynote speaker',
    'Keynote speakers',
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