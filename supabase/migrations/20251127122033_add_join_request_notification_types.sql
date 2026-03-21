/*
  # Add Join Request Notification Types
  
  ## Problem
  The join request notification trigger uses 'join_request_approved' and 'join_request_rejected'
  notification types, but these are not in the allowed types constraint.
  
  ## Changes
  1. Update the notifications table constraint to include join request notification types
  2. This allows the trigger to properly send notifications when requests are approved/rejected
  
  ## New Types Added
  - 'join_request_approved' - When a join request is approved
  - 'join_request_rejected' - When a join request is rejected
*/

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_type;

-- Add the constraint with new types
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type 
CHECK (type IN (
  'general',
  'club_added',
  'role_changed',
  'meeting_reminder',
  'award_received',
  'join_request_approved',
  'join_request_rejected'
));
