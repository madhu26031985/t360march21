/*
  # Add Educational Topic Column to Meeting Agenda Items

  ## Summary
  Adds a dedicated column for storing educational speech titles in the agenda
  instead of keeping them in the JSONB role_details field.

  ## Changes
  1. New Column
    - `educational_topic` (text, nullable) - Stores the educational speech title
  
  2. Data Migration
    - Extract existing educational_topic values from role_details JSONB
    - Populate the new column with these values
  
  3. Index
    - Add index on educational_topic for better query performance

  ## Notes
  - This provides better queryability and clarity for educational speech titles
  - The role_details JSONB will still contain the summary and other metadata
*/

-- Add the educational_topic column
ALTER TABLE meeting_agenda_items
  ADD COLUMN IF NOT EXISTS educational_topic TEXT;

-- Migrate existing data from role_details->>'educational_topic' to the new column
UPDATE meeting_agenda_items
SET educational_topic = role_details->>'educational_topic'
WHERE section_name = 'Educational Speaker'
  AND role_details IS NOT NULL
  AND role_details->>'educational_topic' IS NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_educational_topic 
  ON meeting_agenda_items(educational_topic) 
  WHERE educational_topic IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN meeting_agenda_items.educational_topic IS 
  'Educational speech title for Educational Speaker agenda items. This field provides direct access to the speech title without parsing JSONB.';