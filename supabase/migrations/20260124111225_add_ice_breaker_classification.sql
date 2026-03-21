/*
  # Add Ice Breaker Classification
  
  1. Changes
    - Add "Ice Breaker" to the valid role_classification values in app_meeting_roles
    - Update all Ice Breaker Speech roles to use the new classification
  
  2. Security
    - No changes to RLS policies
*/

-- Drop the existing constraint
ALTER TABLE app_meeting_roles 
DROP CONSTRAINT IF EXISTS chk_role_classification_valid;

-- Add the new constraint with "Ice Breaker" included
ALTER TABLE app_meeting_roles 
ADD CONSTRAINT chk_role_classification_valid 
CHECK (role_classification = ANY (ARRAY[
  'Key Speakers'::text, 
  'Prepared Speaker'::text, 
  'Ice Breaker'::text,
  'Club Speakers'::text, 
  'Educational speaker'::text, 
  'Speech evaluvator'::text, 
  'Master evaluvator'::text, 
  'TT _ Evaluvator'::text, 
  'On-the-Spot Speaking'::text, 
  'Tag roles'::text, 
  'Ancillary Speaker'::text, 
  'Judge'::text, 
  'Keynote speakers'::text
]));

-- Update Ice Breaker Speech roles to use the new classification
UPDATE app_meeting_roles
SET role_classification = 'Ice Breaker',
    updated_at = NOW()
WHERE meeting_role_name LIKE 'Ice Breaker%';
