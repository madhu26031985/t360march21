/*
  # Restore: Keynote Speakers Plural Constraint
  
  1. Changes
    - Add both 'Keynote Speaker' (singular) and 'Keynote speakers' (plural) to constraint
    - This allows both variations to coexist
    
  2. Details
    - Supports legacy data with singular form
    - Supports new data with plural form
*/

-- Drop the current constraint first
ALTER TABLE app_meeting_roles_management
DROP CONSTRAINT IF EXISTS chk_app_meeting_roles_management_role_classification;

-- Recreate constraint with both keynote variations
ALTER TABLE app_meeting_roles_management 
ADD CONSTRAINT chk_app_meeting_roles_management_role_classification 
CHECK (
  role_classification IS NULL OR role_classification = ANY (ARRAY[
    'Key Speakers'::text,
    'Keynote Speaker'::text,
    'Keynote speakers'::text,
    'Prepared Speaker'::text,
    'Club Speakers'::text,
    'Educational speaker'::text,
    'Speech evaluvator'::text,
    'Master evaluvator'::text,
    'TT _ Evaluvator'::text,
    'On-the-Spot Speaking'::text,
    'Tag roles'::text,
    'Ancillary Speaker'::text,
    'Ice Breaker'::text
  ])
);
