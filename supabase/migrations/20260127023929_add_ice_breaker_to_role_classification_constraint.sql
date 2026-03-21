/*
  # Add Ice Breaker to Role Classification Constraint

  ## Summary
  This migration adds "Ice Breaker" to the role_classification check constraint
  to fix the meeting creation error.

  ## Issue
  When creating a meeting, the auto_populate_meeting_roles trigger inserts roles
  from app_meeting_roles table. The "Ice Breaker" classification exists in that table
  but is not in the check constraint, causing meeting creation to fail.

  ## Changes
  1. Drop existing check constraint
  2. Recreate it with "Ice Breaker" added to the allowed values

  ## Security
  No RLS changes needed
*/

-- Drop the existing constraint
ALTER TABLE app_meeting_roles_management 
DROP CONSTRAINT IF EXISTS chk_app_meeting_roles_management_role_classification;

-- Recreate the constraint with Ice Breaker included
ALTER TABLE app_meeting_roles_management 
ADD CONSTRAINT chk_app_meeting_roles_management_role_classification 
CHECK (
  role_classification IS NULL OR role_classification IN (
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
    'Judge',
    'Ice Breaker'
  )
);
