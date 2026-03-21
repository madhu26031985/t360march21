/*
  # Add Individual Visibility Controls for Tag Team Roles

  ## Summary
  Adds visibility toggles for each Tag Team role (Timer, Ah Counter, Grammarian)
  so ExComm can hide unfilled roles from the meeting agenda view.

  ## Changes
  1. Add timer_visible column to meeting_agenda_items (default true)
  2. Add ah_counter_visible column to meeting_agenda_items (default true)
  3. Add grammarian_visible column to meeting_agenda_items (default true)

  ## Notes
  - All roles are visible by default
  - ExComm can toggle visibility for each role individually
  - No RLS changes needed (inherits existing agenda item policies)
*/

-- Add visibility columns for Tag Team roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_agenda_items' AND column_name = 'timer_visible'
  ) THEN
    ALTER TABLE meeting_agenda_items ADD COLUMN timer_visible boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_agenda_items' AND column_name = 'ah_counter_visible'
  ) THEN
    ALTER TABLE meeting_agenda_items ADD COLUMN ah_counter_visible boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_agenda_items' AND column_name = 'grammarian_visible'
  ) THEN
    ALTER TABLE meeting_agenda_items ADD COLUMN grammarian_visible boolean DEFAULT true;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN meeting_agenda_items.timer_visible IS 'Whether Timer role is visible in the agenda (can be hidden if unfilled)';
COMMENT ON COLUMN meeting_agenda_items.ah_counter_visible IS 'Whether Ah Counter role is visible in the agenda (can be hidden if unfilled)';
COMMENT ON COLUMN meeting_agenda_items.grammarian_visible IS 'Whether Grammarian role is visible in the agenda (can be hidden if unfilled)';
