/*
  # Add manual member name to usage tracking tables

  ## Summary
  Adds a `member_name_manual` column to the three grammarian member usage tables
  to support last-minute manual entry of non-app members during live meetings.
  Also makes `member_user_id` nullable to allow manual-only entries.

  ## Changes
  - `grammarian_word_of_the_day_member_usage`: add member_name_manual (text, nullable), make member_user_id nullable
  - `grammarian_idiom_of_the_day_member_usage`: same
  - `grammarian_quote_of_the_day_member_usage`: same
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammarian_word_of_the_day_member_usage' AND column_name = 'member_name_manual'
  ) THEN
    ALTER TABLE grammarian_word_of_the_day_member_usage ADD COLUMN member_name_manual text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammarian_idiom_of_the_day_member_usage' AND column_name = 'member_name_manual'
  ) THEN
    ALTER TABLE grammarian_idiom_of_the_day_member_usage ADD COLUMN member_name_manual text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammarian_quote_of_the_day_member_usage' AND column_name = 'member_name_manual'
  ) THEN
    ALTER TABLE grammarian_quote_of_the_day_member_usage ADD COLUMN member_name_manual text;
  END IF;
END $$;

ALTER TABLE grammarian_word_of_the_day_member_usage ALTER COLUMN member_user_id DROP NOT NULL;
ALTER TABLE grammarian_idiom_of_the_day_member_usage ALTER COLUMN member_user_id DROP NOT NULL;
ALTER TABLE grammarian_quote_of_the_day_member_usage ALTER COLUMN member_user_id DROP NOT NULL;
