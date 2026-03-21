/*
  # Add Usage Count Tracking to Grammarian Features

  ## Summary
  Adds usage_count field to Word of the Day, Idiom of the Day, and Quote of the Day tables
  to track how many times members used these during meetings.

  ## Changes
  1. Add `usage_count` column to `grammarian_word_of_the_day`
     - Integer field with default value of 0
     - Non-negative constraint

  2. Add `usage_count` column to `grammarian_idiom_of_the_day`
     - Integer field with default value of 0
     - Non-negative constraint

  3. Add `usage_count` column to `grammarian_quote_of_the_day`
     - Integer field with default value of 0
     - Non-negative constraint

  ## Notes
  - Allows grammarians to track engagement with word/idiom/quote during meetings
  - Counter can be incremented/decremented as members use these in their speeches
*/

-- Add usage_count to grammarian_word_of_the_day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammarian_word_of_the_day' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE grammarian_word_of_the_day ADD COLUMN usage_count integer DEFAULT 0;
    ALTER TABLE grammarian_word_of_the_day ADD CONSTRAINT chk_word_usage_count_non_negative CHECK (usage_count >= 0);
  END IF;
END $$;

-- Add usage_count to grammarian_idiom_of_the_day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammarian_idiom_of_the_day' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE grammarian_idiom_of_the_day ADD COLUMN usage_count integer DEFAULT 0;
    ALTER TABLE grammarian_idiom_of_the_day ADD CONSTRAINT chk_idiom_usage_count_non_negative CHECK (usage_count >= 0);
  END IF;
END $$;

-- Add usage_count to grammarian_quote_of_the_day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammarian_quote_of_the_day' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE grammarian_quote_of_the_day ADD COLUMN usage_count integer DEFAULT 0;
    ALTER TABLE grammarian_quote_of_the_day ADD CONSTRAINT chk_quote_usage_count_non_negative CHECK (usage_count >= 0);
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN grammarian_word_of_the_day.usage_count IS 'Number of times members used this word during the meeting';
COMMENT ON COLUMN grammarian_idiom_of_the_day.usage_count IS 'Number of times members used this idiom during the meeting';
COMMENT ON COLUMN grammarian_quote_of_the_day.usage_count IS 'Number of times members referenced this quote during the meeting';
