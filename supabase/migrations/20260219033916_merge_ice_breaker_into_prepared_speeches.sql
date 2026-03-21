/*
  # Merge Ice Breaker Sessions into Prepared Speeches Session
  
  1. Changes
    - Deactivate the "Ice Breaker Sessions" section (set is_active = false)
    - Update "Prepared Speeches Session" description to include ice breakers
    - Shift sections after Ice Breaker up by one position
  
  2. Rationale
    - Ice breakers are a type of prepared speech
    - Simplifies agenda by combining related speech types
    - All speech details (prepared speech 1-5 and ice breaker 1-5) will show under one section
*/

-- Update Prepared Speeches Session description to include ice breakers
UPDATE agenda_item_templates 
SET section_description = 'Prepared speeches including regular projects and ice breaker speeches. Each speaker delivers their speech followed by evaluation.',
    updated_at = now()
WHERE section_name = 'Prepared Speeches Session';

-- Deactivate Ice Breaker Sessions section
UPDATE agenda_item_templates 
SET is_active = false,
    updated_at = now()
WHERE section_name = 'Ice Breaker Sessions';

-- Shift sections after Ice Breaker (positions 9+) up by one position in templates
UPDATE agenda_item_templates 
SET section_order = section_order - 1,
    updated_at = now()
WHERE section_order >= 9 AND is_active = true;

-- Now update existing meeting agenda items
-- Update description for existing Prepared Speeches sections
UPDATE meeting_agenda_items 
SET section_description = 'Prepared speeches including regular projects and ice breaker speeches. Each speaker delivers their speech followed by evaluation.',
    updated_at = now()
WHERE section_name = 'Prepared Speeches Session';

-- Mark Ice Breaker Sessions as hidden/inactive in existing meetings
UPDATE meeting_agenda_items 
SET is_visible = false,
    updated_at = now()
WHERE section_name = 'Ice Breaker Sessions';

-- Shift existing meeting sections after position 8 up by one
UPDATE meeting_agenda_items 
SET section_order = section_order - 1,
    updated_at = now()
WHERE section_order >= 9 AND section_name != 'Ice Breaker Sessions';
