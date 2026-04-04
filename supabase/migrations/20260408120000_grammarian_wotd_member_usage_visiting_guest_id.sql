/*
  Link Grammarian word-of-the-day per-person usage to `app_meeting_visiting_guests`
  (same roster as Timer), instead of only denormalized `member_name_manual`.

  - Add `visiting_guest_id` FK (ON DELETE SET NULL).
  - Replace `unique_word_member` with partial unique indexes (club member vs visiting guest).
  - Enforce: not both member and guest; at least one of member_user_id, visiting_guest_id, or manual name.
  - Backfill `visiting_guest_id` where manual name matches roster display_name for the same meeting.
*/

ALTER TABLE public.grammarian_word_of_the_day_member_usage
  DROP CONSTRAINT IF EXISTS unique_word_member;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wotd_member_usage_club_member
  ON public.grammarian_word_of_the_day_member_usage (word_of_the_day_id, member_user_id)
  WHERE member_user_id IS NOT NULL;

ALTER TABLE public.grammarian_word_of_the_day_member_usage
  ADD COLUMN IF NOT EXISTS visiting_guest_id uuid;

ALTER TABLE public.grammarian_word_of_the_day_member_usage
  ADD CONSTRAINT fk_wotd_member_usage_visiting_guest
  FOREIGN KEY (visiting_guest_id)
  REFERENCES public.app_meeting_visiting_guests (id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wotd_member_usage_visiting_guest
  ON public.grammarian_word_of_the_day_member_usage (word_of_the_day_id, visiting_guest_id)
  WHERE visiting_guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_word_member_usage_visiting_guest_id
  ON public.grammarian_word_of_the_day_member_usage (visiting_guest_id)
  WHERE visiting_guest_id IS NOT NULL;

ALTER TABLE public.grammarian_word_of_the_day_member_usage
  ADD CONSTRAINT chk_wotd_member_usage_person
  CHECK (
    NOT (member_user_id IS NOT NULL AND visiting_guest_id IS NOT NULL)
    AND (
      member_user_id IS NOT NULL
      OR visiting_guest_id IS NOT NULL
      OR (member_name_manual IS NOT NULL AND btrim(member_name_manual) <> '')
    )
  );

COMMENT ON COLUMN public.grammarian_word_of_the_day_member_usage.visiting_guest_id IS
  'When set, usage row is tied to a visiting guest slot on this meeting roster (app_meeting_visiting_guests).';
