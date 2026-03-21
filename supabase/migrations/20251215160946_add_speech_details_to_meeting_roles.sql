/*
  # Add Speech Details to Meeting Roles

  ## Summary
  Adds columns to track speech-specific details for prepared speaker roles,
  including pathway, level, project title, and speech title.

  ## Changes
  1. New Columns
    - `speech_title` - The title of the speech delivered
    - `pathway_name` - The Toastmasters pathway (e.g., "Dynamic Leadership")
    - `pathway_level` - The level number (1-5)
    - `project_title` - The project name within the pathway
  
  2. Updates
    - Only applies to roles with classification 'Prepared Speaker'
    - All fields are optional (nullable) as existing records won't have this data
  
  ## Security
    - No RLS changes needed (inherits from table's existing policies)
*/

-- Add speech tracking columns to meeting roles
ALTER TABLE app_meeting_roles_management 
  ADD COLUMN IF NOT EXISTS speech_title TEXT,
  ADD COLUMN IF NOT EXISTS pathway_name TEXT,
  ADD COLUMN IF NOT EXISTS pathway_level INTEGER,
  ADD COLUMN IF NOT EXISTS project_title TEXT;

-- Add index for better query performance on prepared speaker roles
CREATE INDEX IF NOT EXISTS idx_meeting_roles_prepared_speakers 
  ON app_meeting_roles_management(assigned_user_id, role_classification, is_completed)
  WHERE role_classification = 'Prepared Speaker';

-- Add comment for documentation
COMMENT ON COLUMN app_meeting_roles_management.speech_title IS 'Title of the speech delivered for Prepared Speaker roles';
COMMENT ON COLUMN app_meeting_roles_management.pathway_name IS 'Toastmasters pathway name (e.g., Dynamic Leadership, Persuasive Influence)';
COMMENT ON COLUMN app_meeting_roles_management.pathway_level IS 'Pathway level number (1-5)';
COMMENT ON COLUMN app_meeting_roles_management.project_title IS 'Project name within the pathway';
