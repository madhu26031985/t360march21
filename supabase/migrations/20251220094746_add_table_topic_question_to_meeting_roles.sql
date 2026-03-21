/*
  # Add Table Topic Question to Meeting Roles

  ## Summary
  Adds a column to track the specific question assigned to table topic speakers
  by the Table Topics Master.

  ## Changes
  1. New Column
    - `table_topic_question` - The question assigned to the speaker
  
  2. Updates
    - Only applies to roles with classification 'On-the-Spot Speaking'
    - Field is optional (nullable) as existing records won't have this data
  
  ## Security
    - No RLS changes needed (inherits from table's existing policies)
*/

-- Add table topic question column to meeting roles
ALTER TABLE app_meeting_roles_management 
  ADD COLUMN IF NOT EXISTS table_topic_question TEXT;

-- Add comment for documentation
COMMENT ON COLUMN app_meeting_roles_management.table_topic_question IS 'The table topic question assigned by the Table Topics Master for On-the-Spot Speaking roles';
