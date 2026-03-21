/*
  # Sync agenda_item_templates to use clubs table IDs
  
  ## Summary
  This migration updates agenda_item_templates.club_id to reference the clubs table
  instead of club_profiles. It maps the old club_profiles IDs to the new clubs IDs
  based on club name, then updates the foreign key constraint.
  
  ## Changes
  1. Drop old foreign key constraint pointing to club_profiles
  2. Update existing agenda_item_templates records to use clubs table IDs  
  3. Create new foreign key constraint pointing to clubs table
  
  ## Security
  - No RLS changes needed
*/

-- Step 1: Drop the old foreign key constraint first
ALTER TABLE agenda_item_templates 
  DROP CONSTRAINT IF EXISTS agenda_item_templates_club_id_fkey;

-- Step 2: Update agenda_item_templates to use clubs table IDs (only for non-NULL club_ids)
UPDATE agenda_item_templates ait
SET club_id = c.id
FROM club_profiles cp
JOIN clubs c ON c.name = cp.club_name
WHERE ait.club_id = cp.id
  AND ait.club_id IS NOT NULL
  AND ait.club_id != c.id;

-- Step 3: Add new foreign key constraint pointing to clubs table
ALTER TABLE agenda_item_templates 
  ADD CONSTRAINT agenda_item_templates_club_id_fkey 
  FOREIGN KEY (club_id) 
  REFERENCES clubs(id) 
  ON DELETE CASCADE;

-- Add comment
COMMENT ON CONSTRAINT agenda_item_templates_club_id_fkey ON agenda_item_templates IS 
  'References the clubs table (not club_profiles) for proper club association';
