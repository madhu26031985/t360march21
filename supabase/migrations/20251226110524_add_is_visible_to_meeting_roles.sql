/*
  # Add visibility toggle to meeting roles

  1. Changes
    - Add `is_visible` column to `app_meeting_roles_management` table
    - Default to true for existing and new roles
    - Allows hiding individual ancillary roles from the meeting agenda

  2. Purpose
    - Enable excomm to hide specific ancillary roles (Timer, Ah-Counter, Grammarian, Listener) from the meeting agenda
    - Provides flexibility in agenda management
*/

-- Add is_visible column to app_meeting_roles_management
ALTER TABLE app_meeting_roles_management
ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true;

-- Set all existing roles to visible
UPDATE app_meeting_roles_management
SET is_visible = true
WHERE is_visible IS NULL;
