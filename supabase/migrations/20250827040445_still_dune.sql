/*
  # Fix Meeting Roles Auto-Population

  1. Database Function Updates
    - Drop existing trigger first to avoid dependency issues
    - Update auto_populate_meeting_roles function with correct column mapping
    - Recreate trigger with updated function
    - Seed default meeting roles if none exist

  2. Column Mapping Fix
    - app_meeting_roles.meeting_role_name → app_meeting_roles_management.role_name
    - app_meeting_roles.meeting_role_metric → app_meeting_roles_management.role_metric  
    - app_meeting_roles.id → app_meeting_roles_management.role_id

  3. Default Roles
    - Ensures basic meeting roles exist for auto-population
    - Includes proper role classifications and metrics
*/

-- Step 1: Drop the existing trigger first
DROP TRIGGER IF EXISTS trigger_auto_populate_meeting_roles ON app_club_meeting;

-- Step 2: Drop and recreate the function with correct column mapping
DROP FUNCTION IF EXISTS auto_populate_meeting_roles();

CREATE OR REPLACE FUNCTION auto_populate_meeting_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert roles from app_meeting_roles into app_meeting_roles_management
  INSERT INTO app_meeting_roles_management (
    meeting_id,
    role_id,
    role_name,
    role_metric,
    assigned_user_id,
    is_required,
    max_participants,
    order_index,
    booking_status,
    role_status,
    role_classification,
    club_id,
    is_completed,
    created_at,
    updated_at
  )
  SELECT 
    NEW.id as meeting_id,
    amr.id as role_id,
    amr.meeting_role_name as role_name,
    amr.meeting_role_metric as role_metric,
    NULL as assigned_user_id,
    FALSE as is_required,
    1 as max_participants,
    ROW_NUMBER() OVER (ORDER BY amr.meeting_role_name) as order_index,
    'open' as booking_status,
    'Available' as role_status,
    amr.role_classification,
    NEW.club_id as club_id,
    FALSE as is_completed,
    NOW() as created_at,
    NOW() as updated_at
  FROM app_meeting_roles amr
  WHERE amr.meeting_role_name IS NOT NULL
    AND amr.meeting_role_metric IS NOT NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Recreate the trigger
CREATE TRIGGER trigger_auto_populate_meeting_roles
  AFTER INSERT ON app_club_meeting
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_meeting_roles();

-- Step 4: Seed default meeting roles if none exist
INSERT INTO app_meeting_roles (meeting_role_name, meeting_role_metric, role_classification, created_at, updated_at)
SELECT * FROM (VALUES
  ('Toastmaster', 'roles_completed', 'Key Speakers', NOW(), NOW()),
  ('General Evaluator', 'roles_completed', 'Master evaluvator', NOW(), NOW()),
  ('Timer', 'roles_completed', 'Tag roles', NOW(), NOW()),
  ('Ah Counter', 'roles_completed', 'Tag roles', NOW(), NOW()),
  ('Grammarian', 'roles_completed', 'Tag roles', NOW(), NOW()),
  ('Table Topics Master', 'roles_completed', 'On-the-Spot Speaking', NOW(), NOW()),
  ('Prepared Speaker 1', 'speeches_delivered', 'Prepared Speaker', NOW(), NOW()),
  ('Prepared Speaker 2', 'speeches_delivered', 'Prepared Speaker', NOW(), NOW()),
  ('Prepared Speaker 3', 'speeches_delivered', 'Prepared Speaker', NOW(), NOW()),
  ('Speech Evaluator 1', 'evaluations_given', 'Speech evaluvator', NOW(), NOW()),
  ('Speech Evaluator 2', 'evaluations_given', 'Speech evaluvator', NOW(), NOW()),
  ('Speech Evaluator 3', 'evaluations_given', 'Speech evaluvator', NOW(), NOW()),
  ('Table Topics Participant 1', 'table_topics_participated', 'On-the-Spot Speaking', NOW(), NOW()),
  ('Table Topics Participant 2', 'table_topics_participated', 'On-the-Spot Speaking', NOW(), NOW()),
  ('Table Topics Participant 3', 'table_topics_participated', 'On-the-Spot Speaking', NOW(), NOW()),
  ('Table Topics Participant 4', 'table_topics_participated', 'On-the-Spot Speaking', NOW(), NOW()),
  ('Table Topics Participant 5', 'table_topics_participated', 'On-the-Spot Speaking', NOW(), NOW())
) AS v(meeting_role_name, meeting_role_metric, role_classification, created_at, updated_at)
WHERE NOT EXISTS (
  SELECT 1 FROM app_meeting_roles 
  WHERE meeting_role_name = v.meeting_role_name
);