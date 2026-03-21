/*
  # Add role_classification column and update existing roles

  1. Schema Changes
    - Add `role_classification` column to `app_meeting_roles` table
    - Set default value and constraints
    - Add index for better performance

  2. Data Updates
    - Update all existing roles with proper classifications
    - Organize roles into logical categories for better management

  3. Role Classifications
    - Key Speakers: Main meeting leaders
    - Prepared Speaker: Scheduled speech presenters
    - Club Speakers: Club administrative speakers
    - Educational speaker: Educational content presenters
    - Speech evaluvator: Individual speech evaluators
    - Master evaluvator: Lead evaluators
    - TT _ Evaluvator: Table topics evaluators
    - On-the-Spot Speaking: Table topics participants
    - Tag roles: Meeting support roles
    - Ancillary Speaker: Additional speakers
    - Judge: Contest judges
*/

-- Add the role_classification column
ALTER TABLE app_meeting_roles 
ADD COLUMN IF NOT EXISTS role_classification TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_classification 
ON app_meeting_roles (role_classification);

-- Update existing roles with their classifications
UPDATE app_meeting_roles 
SET role_classification = 'Key Speakers'
WHERE meeting_role_name IN ('Toastmaster of the Day', 'Table Topics Master', 'General Evaluator');

UPDATE app_meeting_roles 
SET role_classification = 'Prepared Speaker'
WHERE meeting_role_name IN (
  'Speaker 1', 'Speaker 2', 'Speaker 3', 'Speaker 4', 'Speaker 5', 'Speaker 6',
  'Speaker 7', 'Speaker 8', 'Speaker 9', 'Speaker 10', 'Speaker 11', 'Speaker 12'
);

UPDATE app_meeting_roles 
SET role_classification = 'Club Speakers'
WHERE meeting_role_name IN ('Presiding Officer', 'Sergeant at Arms');

UPDATE app_meeting_roles 
SET role_classification = 'Educational speaker'
WHERE meeting_role_name = 'Educational Speaker';

UPDATE app_meeting_roles 
SET role_classification = 'Speech evaluvator'
WHERE meeting_role_name IN (
  'Evaluator 1', 'Evaluator 2', 'Evaluator 3', 'Evaluator 4', 'Evaluator 5', 'Evaluator 6',
  'Evaluator 7', 'Evaluator 8', 'Evaluator 9', 'Evaluator 10', 'Evaluator 11', 'Evaluator 12'
);

UPDATE app_meeting_roles 
SET role_classification = 'Master evaluvator'
WHERE meeting_role_name IN (
  'Master Evaluator 1', 'Master Evaluator 2', 'Master Evaluator 3', 'Master Evaluator 4',
  'Master Evaluator 5', 'Master Evaluator 6', 'Master Evaluator 7', 'Master Evaluator 8',
  'Master Evaluator 9', 'Master Evaluator 10', 'Master Evaluator 11', 'Master Evaluator 12'
);

UPDATE app_meeting_roles 
SET role_classification = 'TT _ Evaluvator'
WHERE meeting_role_name IN (
  'Table Topic Evaluator 1', 'Table Topic Evaluator 2', 'Table Topic Evaluator 3', 'Table Topic Evaluator 4',
  'Table Topic Evaluator 5', 'Table Topic Evaluator 6', 'Table Topic Evaluator 7', 'Table Topic Evaluator 8',
  'Table Topic Evaluator 9', 'Table Topic Evaluator 10', 'Table Topic Evaluator 11', 'Table Topic Evaluator 12'
);

UPDATE app_meeting_roles 
SET role_classification = 'On-the-Spot Speaking'
WHERE meeting_role_name IN (
  'Table Topics Speaker 1', 'Table Topics Speaker 2', 'Table Topics Speaker 3', 'Table Topics Speaker 4',
  'Table Topics Speaker 5', 'Table Topics Speaker 6', 'Table Topics Speaker 7', 'Table Topics Speaker 8',
  'Table Topics Speaker 9', 'Table Topics Speaker 10', 'Table Topics Speaker 11', 'Table Topics Speaker 12'
);

UPDATE app_meeting_roles 
SET role_classification = 'Tag roles'
WHERE meeting_role_name IN ('Grammarian', 'Timer', 'Ah Counter');

UPDATE app_meeting_roles 
SET role_classification = 'Ancillary Speaker'
WHERE meeting_role_name IN ('Guest Introducer', 'Listener', 'Quiz Master');

UPDATE app_meeting_roles 
SET role_classification = 'Judge'
WHERE meeting_role_name IN (
  'Chief Judge 1', 'Chief Judge 2', 'Chief Judge 3', 'Chief Judge 4', 'Chief Judge 5', 'Chief Judge 6',
  'Chief Judge 7', 'Chief Judge 8', 'Chief Judge 9', 'Chief Judge 10', 'Chief Judge 11', 'Chief Judge 12'
);

-- Add constraint to ensure valid classifications
ALTER TABLE app_meeting_roles 
ADD CONSTRAINT chk_role_classification_valid 
CHECK (role_classification IN (
  'Key Speakers', 'Prepared Speaker', 'Club Speakers', 'Educational speaker',
  'Speech evaluvator', 'Master evaluvator', 'TT _ Evaluvator', 'On-the-Spot Speaking',
  'Tag roles', 'Ancillary Speaker', 'Judge'
));