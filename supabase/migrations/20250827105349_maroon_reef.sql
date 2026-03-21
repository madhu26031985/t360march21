/*
  # Add Prepared Speaker 4 and 5 to Meeting Roles

  1. New Roles
    - Add `Prepared Speaker 4` with `speeches_delivered` metric
    - Add `Prepared Speaker 5` with `speeches_delivered` metric
    - Both roles classified as 'Prepared Speaker'

  2. Safety
    - Uses ON CONFLICT DO NOTHING to prevent duplicate entries
    - Maintains existing role structure and constraints
    - Auto-generates UUIDs and timestamps
*/

-- Add Prepared Speaker 4 and 5 to the app_meeting_roles table
INSERT INTO app_meeting_roles (meeting_role_name, meeting_role_metric, role_classification, created_at, updated_at)
VALUES 
  ('Prepared Speaker 4', 'speeches_delivered', 'Prepared Speaker', NOW(), NOW()),
  ('Prepared Speaker 5', 'speeches_delivered', 'Prepared Speaker', NOW(), NOW())
ON CONFLICT (meeting_role_name) DO NOTHING;

-- Verify the insertion
DO $$
DECLARE
  speaker4_exists boolean;
  speaker5_exists boolean;
BEGIN
  -- Check if Prepared Speaker 4 was added
  SELECT EXISTS(
    SELECT 1 FROM app_meeting_roles 
    WHERE meeting_role_name = 'Prepared Speaker 4'
  ) INTO speaker4_exists;
  
  -- Check if Prepared Speaker 5 was added
  SELECT EXISTS(
    SELECT 1 FROM app_meeting_roles 
    WHERE meeting_role_name = 'Prepared Speaker 5'
  ) INTO speaker5_exists;
  
  -- Log the results
  IF speaker4_exists THEN
    RAISE NOTICE 'Successfully added Prepared Speaker 4';
  ELSE
    RAISE NOTICE 'Prepared Speaker 4 already exists or failed to add';
  END IF;
  
  IF speaker5_exists THEN
    RAISE NOTICE 'Successfully added Prepared Speaker 5';
  ELSE
    RAISE NOTICE 'Prepared Speaker 5 already exists or failed to add';
  END IF;
  
  -- Show total count of prepared speakers
  RAISE NOTICE 'Total Prepared Speaker roles: %', (
    SELECT COUNT(*) FROM app_meeting_roles 
    WHERE meeting_role_name LIKE 'Prepared Speaker%'
  );
END $$;