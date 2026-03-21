/*
  # Fix Keynote Constraint - Include Both Variations

  ## Summary
  The app_meeting_roles_management table has 'Keynote Speaker' (singular)
  from old meetings, but app_meeting_roles has 'Keynote speakers' (plural).
  Include both in the constraint to support existing and new data.

  ## Changes
  - Drop current constraint
  - Recreate with both 'Keynote Speaker' and 'Keynote speakers'
*/

-- Drop the current constraint
ALTER TABLE app_meeting_roles_management
DROP CONSTRAINT IF EXISTS chk_app_meeting_roles_management_role_classification;

-- Recreate constraint with both keynote variations plus all other values
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