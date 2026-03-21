/*
  # Fix duplicate agenda sections and prevent recurrence

  ## Problem
  The `auto_create_meeting_agenda_sections` trigger function inserts agenda sections
  with no duplicate guard. When a backfill/migration re-inserted meeting records,
  the trigger fired again and created duplicate (blank) sections for already-configured meetings.

  One meeting had every section tripled (original from Feb 12, plus 2 blank copies from Feb 28).

  ## Fix
  1. Delete duplicate agenda rows — keeping the OLDEST row per (meeting_id, section_name)
     because the oldest rows contain the real assigned user data.
  2. Also clean any dependent child rows from speech_evaluation_items that reference
     the deleted duplicate agenda items.
  3. Add a unique constraint on (meeting_id, section_name) to prevent future duplicates.
  4. Update the trigger function to use ON CONFLICT DO NOTHING as an extra safety net.
*/

-- Step 1: Delete child rows in speech_evaluation_items that reference duplicate agenda items
DELETE FROM speech_evaluation_items
WHERE agenda_item_id IN (
  SELECT id FROM meeting_agenda_items
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY meeting_id, section_name
               ORDER BY created_at ASC
             ) AS rn
      FROM meeting_agenda_items
    ) ranked
    WHERE rn > 1
  )
);

-- Step 2: Delete child rows in grammarian_corner_visibility that reference duplicate agenda items
DELETE FROM grammarian_corner_visibility
WHERE agenda_item_id IN (
  SELECT id FROM meeting_agenda_items
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY meeting_id, section_name
               ORDER BY created_at ASC
             ) AS rn
      FROM meeting_agenda_items
    ) ranked
    WHERE rn > 1
  )
);

-- Step 3: Delete the duplicate agenda items (keep oldest per meeting+section)
DELETE FROM meeting_agenda_items
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY meeting_id, section_name
             ORDER BY created_at ASC
           ) AS rn
    FROM meeting_agenda_items
  ) ranked
  WHERE rn > 1
);

-- Step 4: Add unique constraint to prevent future duplicates
ALTER TABLE meeting_agenda_items
  ADD CONSTRAINT unique_agenda_section_per_meeting
  UNIQUE (meeting_id, section_name);

-- Step 5: Fix the trigger function to use ON CONFLICT DO NOTHING
CREATE OR REPLACE FUNCTION public.auto_create_meeting_agenda_sections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
v_section_order INTEGER := 0;
v_template RECORD;
BEGIN
FOR v_template IN
SELECT * FROM agenda_item_templates
WHERE (club_id = NEW.club_id OR club_id IS NULL)
AND is_active = true
ORDER BY section_order
LOOP
v_section_order := v_section_order + 1;

INSERT INTO meeting_agenda_items (
meeting_id,
club_id,
template_id,
section_name,
section_description,
section_icon,
section_order,
start_time,
end_time,
duration_minutes,
is_auto_generated,
is_visible
) VALUES (
NEW.id,
NEW.club_id,
v_template.id,
v_template.section_name,
v_template.section_description,
v_template.section_icon,
v_section_order,
NULL,
NULL,
COALESCE(v_template.default_duration_minutes, 5),
true,
false
)
ON CONFLICT (meeting_id, section_name) DO NOTHING;
END LOOP;

RETURN NEW;
END;
$function$;
