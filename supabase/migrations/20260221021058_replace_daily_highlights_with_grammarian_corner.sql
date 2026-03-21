/*
  # Replace Daily Highlights with Grammarian Corner
  
  1. Changes
    - Remove "Daily Highlights" section (order 7)
    - Add new "Grammarian Corner" section at same position
    - Add visibility fields for each component (word, idiom, quote)
  
  2. New Table
    - `grammarian_corner_visibility` - tracks visibility settings for each component
  
  3. Structure
    - Grammarian Corner shows three fields:
      * Word of the Day
      * Quote of the Day  
      * Idiom of the Day
    - Each can be individually hidden using eye button
*/

-- Step 1: Delete the old Daily Highlights section from templates
DELETE FROM agenda_item_templates
WHERE section_name = 'Daily Highlights';

-- Step 2: Delete Daily Highlights from existing meeting agendas
DELETE FROM meeting_agenda_items
WHERE section_name = 'Daily Highlights';

-- Step 3: Insert the new Grammarian Corner section template
INSERT INTO agenda_item_templates (
  club_id,
  section_name,
  section_description,
  section_icon,
  section_order,
  default_duration_minutes,
  is_role_based,
  is_active
) VALUES (
  NULL,
  'Grammarian Corner',
  'Word of the Day, Quote of the Day, and Idiom of the Day',
  '📚',
  7,
  5,
  false,
  true
);

-- Step 4: Create table for grammarian corner visibility settings
CREATE TABLE IF NOT EXISTS grammarian_corner_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_item_id uuid NOT NULL REFERENCES meeting_agenda_items(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  word_visible boolean NOT NULL DEFAULT true,
  quote_visible boolean NOT NULL DEFAULT true,
  idiom_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agenda_item_id)
);

-- Enable RLS
ALTER TABLE grammarian_corner_visibility ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Club members can view grammarian corner visibility"
ON grammarian_corner_visibility
FOR SELECT
TO authenticated
USING (
  club_id IN (
    SELECT club_id 
    FROM app_club_user_relationship 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Club ExComm can update grammarian corner visibility"
ON grammarian_corner_visibility
FOR ALL
TO authenticated
USING (
  club_id IN (
    SELECT club_id 
    FROM app_club_user_relationship 
    WHERE user_id = auth.uid() 
    AND role = 'excomm'
  )
)
WITH CHECK (
  club_id IN (
    SELECT club_id 
    FROM app_club_user_relationship 
    WHERE user_id = auth.uid() 
    AND role = 'excomm'
  )
);

-- Step 5: Create trigger to auto-create visibility record for new Grammarian Corner agenda items
CREATE OR REPLACE FUNCTION create_grammarian_corner_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.section_name = 'Grammarian Corner' THEN
    INSERT INTO grammarian_corner_visibility (
      agenda_item_id,
      meeting_id,
      club_id,
      word_visible,
      quote_visible,
      idiom_visible
    ) VALUES (
      NEW.id,
      NEW.meeting_id,
      NEW.club_id,
      true,
      true,
      true
    )
    ON CONFLICT (agenda_item_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_grammarian_corner_visibility_trigger
AFTER INSERT ON meeting_agenda_items
FOR EACH ROW
EXECUTE FUNCTION create_grammarian_corner_visibility();

-- Step 6: Backfill Grammarian Corner to all existing meetings
INSERT INTO meeting_agenda_items (
  meeting_id,
  club_id,
  section_name,
  section_description,
  section_icon,
  section_order,
  duration_minutes,
  is_visible,
  is_auto_generated
)
SELECT 
  m.id as meeting_id,
  m.club_id,
  'Grammarian Corner',
  'Word of the Day, Quote of the Day, and Idiom of the Day',
  '📚',
  7,
  5,
  true,
  true
FROM app_club_meeting m
WHERE NOT EXISTS (
  SELECT 1 
  FROM meeting_agenda_items mai
  WHERE mai.meeting_id = m.id
  AND mai.section_name = 'Grammarian Corner'
)
AND m.created_at IS NOT NULL;
