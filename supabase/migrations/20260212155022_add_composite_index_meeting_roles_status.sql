/*
  # Performance Optimization for Meeting Role Management

  1. New Indexes
    - Composite index on (meeting_id, role_status) for faster filtering
    - This optimizes the common query pattern of fetching roles by meeting and status

  2. Purpose
    - Speeds up queries in manage-meeting-roles screen
    - Reduces query time when filtering available vs deleted roles
*/

-- Add composite index for meeting_id + role_status
-- This is the most common query pattern in manage-meeting-roles
CREATE INDEX IF NOT EXISTS idx_meeting_roles_meeting_status 
ON app_meeting_roles_management (meeting_id, role_status);

-- Add index for meeting_id + role_status + role_classification
-- This optimizes the filtered classification view
CREATE INDEX IF NOT EXISTS idx_meeting_roles_meeting_status_classification
ON app_meeting_roles_management (meeting_id, role_status, role_classification)
WHERE role_classification IS NOT NULL;
