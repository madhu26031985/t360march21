/*
  # Add Keynote Speakers Role

  ## Summary
  Adds "Keynote speakers" as a new meeting role with the role_classification "Keynote speakers".

  ## Changes
  1. **Update Constraint**: Modify the role_classification constraint to include "Keynote speakers"
  2. **Insert Role**: Add "Keynote speakers" role with:
     - meeting_role_metric: roles_completed
     - role_classification: Keynote speakers

  ## Details
  - This allows clubs to track keynote speaker roles
  - The role will count towards roles_completed metric
  - Can be used for special keynote presentations at meetings
*/

-- Step 1: Drop the existing constraint
ALTER TABLE app_meeting_roles 
DROP CONSTRAINT IF EXISTS chk_role_classification_valid;

-- Step 2: Add the updated constraint with "Keynote speakers" included
ALTER TABLE app_meeting_roles 
ADD CONSTRAINT chk_role_classification_valid 
CHECK (role_classification IN (
  'Key Speakers', 
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
  'Keynote speakers'
));

-- Step 3: Insert the Keynote speakers role
INSERT INTO app_meeting_roles (meeting_role_name, meeting_role_metric, role_classification)
VALUES ('Keynote speakers', 'roles_completed', 'Keynote speakers')
ON CONFLICT (meeting_role_name) DO NOTHING;
