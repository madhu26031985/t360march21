/*
  Remove "Speech Evaluation Session" from all agendas and templates.
  Child rows in speech_evaluation_items are removed via ON DELETE CASCADE.
*/

-- Renumber sections after Speech Evaluation Session for each meeting
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT meeting_id, section_order
    FROM meeting_agenda_items
    WHERE section_name = 'Speech Evaluation Session'
  LOOP
    UPDATE meeting_agenda_items
    SET section_order = section_order - 1,
        updated_at = now()
    WHERE meeting_id = r.meeting_id
      AND section_order > r.section_order;
  END LOOP;
END $$;

DELETE FROM meeting_agenda_items
WHERE section_name = 'Speech Evaluation Session';

-- Templates: close gap in section_order per club (including NULL club_id globals)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT club_id, section_order
    FROM agenda_item_templates
    WHERE section_name = 'Speech Evaluation Session'
  LOOP
    UPDATE agenda_item_templates t
    SET section_order = t.section_order - 1,
        updated_at = now()
    WHERE t.club_id IS NOT DISTINCT FROM r.club_id
      AND t.section_order > r.section_order
      AND t.section_name <> 'Speech Evaluation Session';
  END LOOP;
END $$;

DELETE FROM agenda_item_templates
WHERE section_name = 'Speech Evaluation Session';
