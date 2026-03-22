-- Grammarian Corner: set duration to 0 mins (no allocated time)
-- Word/Quote/Idiom are displayed inline; no separate time slot is needed.

UPDATE agenda_item_templates
SET default_duration_minutes = 0
WHERE section_name = 'Grammarian Corner';

UPDATE meeting_agenda_items
SET duration_minutes = 0
WHERE section_name = 'Grammarian Corner';
