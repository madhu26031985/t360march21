/*
  # Add Tag Team Fields to Meeting Agenda Items

  ## Summary
  Adds fields to store Timer, Ah Counter, and Grammarian assignments directly in the
  meeting_agenda_items table. This allows the Tag Team section to be a regular agenda
  item that can be reordered, timed, and managed like other sections.

  ## Changes
  1. Add timer_user_id column to meeting_agenda_items
  2. Add ah_counter_user_id column to meeting_agenda_items
  3. Add grammarian_user_id column to meeting_agenda_items
  4. Add foreign key constraints to app_user_profiles

  ## Security
  - No RLS changes needed (inherits existing agenda item policies)
*/

-- Add Tag Team user assignment columns to meeting_agenda_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_agenda_items' AND column_name = 'timer_user_id'
  ) THEN
    ALTER TABLE meeting_agenda_items ADD COLUMN timer_user_id uuid;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_agenda_items' AND column_name = 'ah_counter_user_id'
  ) THEN
    ALTER TABLE meeting_agenda_items ADD COLUMN ah_counter_user_id uuid;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_agenda_items' AND column_name = 'grammarian_user_id'
  ) THEN
    ALTER TABLE meeting_agenda_items ADD COLUMN grammarian_user_id uuid;
  END IF;
END $$;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_meeting_agenda_items_timer_user_id'
  ) THEN
    ALTER TABLE meeting_agenda_items
      ADD CONSTRAINT fk_meeting_agenda_items_timer_user_id
      FOREIGN KEY (timer_user_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_meeting_agenda_items_ah_counter_user_id'
  ) THEN
    ALTER TABLE meeting_agenda_items
      ADD CONSTRAINT fk_meeting_agenda_items_ah_counter_user_id
      FOREIGN KEY (ah_counter_user_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_meeting_agenda_items_grammarian_user_id'
  ) THEN
    ALTER TABLE meeting_agenda_items
      ADD CONSTRAINT fk_meeting_agenda_items_grammarian_user_id
      FOREIGN KEY (grammarian_user_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN meeting_agenda_items.timer_user_id IS 'User assigned as Timer for this meeting (Tag Team role)';
COMMENT ON COLUMN meeting_agenda_items.ah_counter_user_id IS 'User assigned as Ah Counter for this meeting (Tag Team role)';
COMMENT ON COLUMN meeting_agenda_items.grammarian_user_id IS 'User assigned as Grammarian for this meeting (Tag Team role)';
