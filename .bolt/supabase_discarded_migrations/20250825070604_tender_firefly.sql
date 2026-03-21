/*
  # Migrate data from meetings table to app_club_meeting table

  1. Data Migration
    - Transfer compatible fields from `meetings` to `app_club_meeting`
    - Map field names appropriately
    - Preserve existing data integrity
    - Handle null values properly

  2. Field Mapping
    - `title` → `meeting_title`
    - `meeting_number` → `meeting_number` (direct copy)
    - `meeting_date` → `meeting_date` (direct copy)
    - `meeting_time` → `meeting_start_time`
    - `mode` → `meeting_mode`
    - `location` → `meeting_location`
    - `status` → `meeting_status`
    - `club_id` → `club_id` (direct copy)
    - `created_by` → Not available in app_club_meeting
    - `created_at` → `created_at` (direct copy)
    - `updated_at` → `updated_at` (direct copy)

  3. Status Mapping
    - 'scheduled' → 'open'
    - 'ongoing' → 'open'
    - 'completed' → 'close'
    - 'archived' → 'close'

  4. Mode Mapping
    - 'online' → 'online'
    - 'offline' → 'in_person'
    - 'hybrid' → 'hybrid'
*/

-- Insert data from meetings table to app_club_meeting table
INSERT INTO app_club_meeting (
  id,
  club_id,
  meeting_title,
  meeting_date,
  meeting_number,
  meeting_start_time,
  meeting_mode,
  meeting_location,
  meeting_status,
  created_at,
  updated_at
)
SELECT 
  m.id,
  m.club_id,
  m.title as meeting_title,
  m.meeting_date,
  m.meeting_number,
  m.meeting_time as meeting_start_time,
  CASE 
    WHEN m.mode = 'offline' THEN 'in_person'
    WHEN m.mode = 'online' THEN 'online'
    WHEN m.mode = 'hybrid' THEN 'hybrid'
    ELSE 'in_person'
  END as meeting_mode,
  m.location as meeting_location,
  CASE 
    WHEN m.status = 'scheduled' THEN 'open'
    WHEN m.status = 'ongoing' THEN 'open'
    WHEN m.status = 'completed' THEN 'close'
    WHEN m.status = 'archived' THEN 'close'
    ELSE 'open'
  END as meeting_status,
  m.created_at,
  m.updated_at
FROM meetings m
WHERE NOT EXISTS (
  -- Only insert if the meeting doesn't already exist in app_club_meeting
  SELECT 1 FROM app_club_meeting acm WHERE acm.id = m.id
)
AND m.club_id IS NOT NULL
AND m.title IS NOT NULL
AND m.meeting_date IS NOT NULL;

-- Log the migration results
DO $$
DECLARE
  source_count INTEGER;
  migrated_count INTEGER;
  existing_count INTEGER;
BEGIN
  -- Count source records
  SELECT COUNT(*) INTO source_count 
  FROM meetings 
  WHERE club_id IS NOT NULL 
    AND title IS NOT NULL 
    AND meeting_date IS NOT NULL;
  
  -- Count migrated records
  SELECT COUNT(*) INTO migrated_count 
  FROM app_club_meeting;
  
  -- Count existing records that were skipped
  SELECT COUNT(*) INTO existing_count
  FROM meetings m
  WHERE EXISTS (
    SELECT 1 FROM app_club_meeting acm WHERE acm.id = m.id
  );
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '- Source meetings table records: %', source_count;
  RAISE NOTICE '- Total app_club_meeting records after migration: %', migrated_count;
  RAISE NOTICE '- Existing records skipped: %', existing_count;
  RAISE NOTICE '- New records migrated: %', (migrated_count - existing_count);
END $$;