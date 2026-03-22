-- Expand prepared_speeches_agenda from 3 to 5 slots for all Prepared Speeches sections.
-- Existing meetings may have only 3 slots; this backfill ensures 5 slots for consistent display.

DO $$
DECLARE
  rec RECORD;
  arr jsonb;
  slot jsonb;
  slot_num int;
  i int;
  new_slots jsonb := '[]'::jsonb;
  has_slot_4 boolean := false;
  has_slot_5 boolean := false;
BEGIN
  FOR rec IN
    SELECT id, prepared_speeches_agenda
    FROM meeting_agenda_items
    WHERE LOWER(section_name) LIKE '%prepared speech%'
      AND section_name NOT LIKE '%Speech Evaluation%'
  LOOP
    arr := rec.prepared_speeches_agenda;
    IF jsonb_typeof(arr) != 'array' THEN
      arr := '[]'::jsonb;
    END IF;

    has_slot_4 := false;
    has_slot_5 := false;
    FOR i IN 0..GREATEST(0, jsonb_array_length(arr)-1) LOOP
      slot := arr->i;
      slot_num := (slot->>'slot')::int;
      IF slot_num = 4 THEN has_slot_4 := true; END IF;
      IF slot_num = 5 THEN has_slot_5 := true; END IF;
    END LOOP;

    -- If missing slot 4 or 5, expand
    IF NOT has_slot_4 OR NOT has_slot_5 THEN
      new_slots := arr;
      IF NOT has_slot_4 THEN
        new_slots := new_slots || jsonb_build_object(
          'slot', 4, 'role_name', 'Prepared Speaker 4', 'booked', false,
          'pathway_id', null, 'speaker_user_id', null, 'speaker_name', null,
          'speech_title', null, 'pathway_name', null, 'level', null,
          'project_number', null, 'project_name', null, 'evaluation_form', null,
          'evaluator_user_id', null, 'evaluator_name', null, 'is_visible', true
        );
      END IF;
      IF NOT has_slot_5 THEN
        new_slots := new_slots || jsonb_build_object(
          'slot', 5, 'role_name', 'Prepared Speaker 5', 'booked', false,
          'pathway_id', null, 'speaker_user_id', null, 'speaker_name', null,
          'speech_title', null, 'pathway_name', null, 'level', null,
          'project_number', null, 'project_name', null, 'evaluation_form', null,
          'evaluator_user_id', null, 'evaluator_name', null, 'is_visible', true
        );
      END IF;
      UPDATE meeting_agenda_items SET prepared_speeches_agenda = new_slots WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;
