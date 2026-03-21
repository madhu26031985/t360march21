/*
  # Sync meeting_agenda_items to use clubs table IDs
  
  ## Summary
  This migration updates meeting_agenda_items.club_id to reference the clubs table
  instead of club_profiles. It maps the old club_profiles IDs to the new clubs IDs
  based on club name, then updates the foreign key constraint.
  
  ## Changes
  1. Drop old foreign key constraint pointing to club_profiles
  2. Update existing meeting_agenda_items records to use clubs table IDs
  3. Create new foreign key constraint pointing to clubs table
  
  ## Security
  - No RLS changes needed
*/

-- Step 1: Drop the old foreign key constraint first
ALTER TABLE meeting_agenda_items 
  DROP CONSTRAINT IF EXISTS meeting_agenda_items_club_id_fkey;

-- Step 2: Update meeting_agenda_items to use clubs table IDs
UPDATE meeting_agenda_items mai
SET club_id = c.id
FROM club_profiles cp
JOIN clubs c ON c.name = cp.club_name
WHERE mai.club_id = cp.id
  AND mai.club_id != c.id;

-- Step 3: Add new foreign key constraint pointing to clubs table
ALTER TABLE meeting_agenda_items 
  ADD CONSTRAINT meeting_agenda_items_club_id_fkey 
  FOREIGN KEY (club_id) 
  REFERENCES clubs(id) 
  ON DELETE CASCADE;

-- Add comment
COMMENT ON CONSTRAINT meeting_agenda_items_club_id_fkey ON meeting_agenda_items IS 
  'References the clubs table (not club_profiles) for proper club association';
