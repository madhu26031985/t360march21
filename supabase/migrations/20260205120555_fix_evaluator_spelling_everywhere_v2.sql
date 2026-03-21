/*
  # Fix Evaluator Spelling Throughout System

  1. Changes
    - Drop existing role_classification constraint
    - Update all existing data to use correct spelling
    - Create new constraint with correct "Evaluator" spelling (not "evaluvator")
    - Changes affect: Speech Evaluator, Master Evaluator, TT Evaluator

  2. Data Updates
    - 'Speech evaluvator' → 'Speech Evaluator'
    - 'Master evaluvator' → 'Master Evaluator'
    - 'TT _ Evaluvator' → 'TT Evaluator'
*/

-- Drop the old constraint first
ALTER TABLE app_meeting_roles_management
DROP CONSTRAINT IF EXISTS chk_app_meeting_roles_management_role_classification;

-- Update existing data with correct spelling
UPDATE app_meeting_roles_management
SET role_classification = 'Speech Evaluator'
WHERE role_classification = 'Speech evaluvator';

UPDATE app_meeting_roles_management
SET role_classification = 'Master Evaluator'
WHERE role_classification = 'Master evaluvator';

UPDATE app_meeting_roles_management
SET role_classification = 'TT Evaluator'
WHERE role_classification IN ('TT evaluvator', 'TT _ Evaluvator');

-- Create new constraint with correct spelling
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
  'Speech Evaluator'::text,
  'Functionary Roles'::text,
  'Tag Roles'::text,
  'Tag roles'::text,
  'Educational speaker'::text,
  'Club Speakers'::text,
  'On-the-Spot Speaking'::text,
  'Master Evaluator'::text,
  'Ancillary Speaker'::text,
  'Keynote Speaker'::text,
  'Ice Breaker'::text,
  'TT Evaluator'::text
]));
