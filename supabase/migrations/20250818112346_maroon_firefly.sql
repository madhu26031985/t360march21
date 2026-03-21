/*
  # Add General Evaluator Role

  1. New Role
    - `General Evaluator` role with `roles_completed` metric
  
  2. Purpose
    - Adds the General Evaluator meeting role to the available roles list
    - Uses roles_completed metric for performance tracking
*/

INSERT INTO app_meeting_roles (meeting_role_name, meeting_role_metric)
VALUES ('General Evaluator', 'roles_completed')
ON CONFLICT (meeting_role_name) DO NOTHING;