/*
  # Revert: Remove Keynote Speakers Plural from Constraint
  
  1. Changes
    - Update existing 'Keynote speakers' (plural) to 'Keynote Speaker' (singular)
    - Remove 'Keynote speakers' (plural) from constraint
    - Keep only 'Keynote Speaker' (singular)
    
  2. Reason
    - Reverting the fix_keynote_constraint_include_both_variations migration
    - This change was breaking the live product
*/

-- Update existing data from plural to singular
UPDATE app_meeting_roles_management
SET role_classification = 'Keynote Speaker'
WHERE role_classification = 'Keynote speakers';

-- Drop the current constraint
ALTER TABLE app_meeting_roles_management
DROP CONSTRAINT IF EXISTS chk_app_meeting_roles_management_role_classification;

-- Recreate constraint without 'Keynote speakers' plural
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
    'Ice Breaker'
  )
);
