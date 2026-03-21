/*
  # Fix Meeting Roles Auto-Population Trigger

  1. Problem
    - The trigger that auto-populates meeting roles is causing UUID type errors
    - Column "role_id" expects UUID but receives text

  2. Solution
    - Update the trigger function to properly handle UUID generation
    - Ensure all UUID fields are properly cast and generated

  3. Changes
    - Fix the auto_populate_meeting_roles function
    - Ensure proper UUID handling in role creation
*/

-- Drop and recreate the auto populate meeting roles function with proper UUID handling
DROP FUNCTION IF EXISTS auto_populate_meeting_roles() CASCADE;

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
    gen_random_uuid() as role_id, -- Generate new UUID for each role instance
    amr.meeting_role_name as role_name,
    amr.meeting_role_metric as role_metric,
    NULL as assigned_user_id,
    FALSE as is_required,
    1 as max_participants,
    ROW_NUMBER() OVER (ORDER BY amr.meeting_role_name) - 1 as order_index,
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_populate_meeting_roles ON app_club_meeting;

CREATE TRIGGER trigger_auto_populate_meeting_roles
  AFTER INSERT ON app_club_meeting
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_meeting_roles();

-- Also ensure we have some default roles in app_meeting_roles if they don't exist
INSERT INTO app_meeting_roles (meeting_role_name, meeting_role_metric, role_classification) 
VALUES 
  ('Toastmaster', 'roles_completed', 'Key Speakers'),
  ('General Evaluator', 'roles_completed', 'Master evaluvator'),
  ('Timer', 'roles_completed', 'Tag roles'),
  ('Ah Counter', 'roles_completed', 'Tag roles'),
  ('Grammarian', 'roles_completed', 'Tag roles'),
  ('Table Topics Master', 'roles_completed', 'On-the-Spot Speaking'),
  ('Prepared Speaker 1', 'speeches_delivered', 'Prepared Speaker'),
  ('Prepared Speaker 2', 'speeches_delivered', 'Prepared Speaker'),
  ('Evaluator 1', 'evaluations_given', 'Speech evaluvator'),
  ('Evaluator 2', 'evaluations_given', 'Speech evaluvator'),
  ('Table Topics Participant 1', 'table_topics_participated', 'On-the-Spot Speaking'),
  ('Table Topics Participant 2', 'table_topics_participated', 'On-the-Spot Speaking'),
  ('Table Topics Participant 3', 'table_topics_participated', 'On-the-Spot Speaking')
ON CONFLICT (meeting_role_name) DO NOTHING;