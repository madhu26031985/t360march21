/*
  # Add Part of Speech to Word of the Day

  1. Changes
    - Add `part_of_speech` column to `grammarian_word_of_the_day` table
    - This field will store the grammatical category (noun, verb, adjective, etc.)
    - Optional field with no default value

  2. Notes
    - Existing records will have NULL part_of_speech, which is acceptable
    - Field will be displayed below the word in italic text
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammarian_word_of_the_day' AND column_name = 'part_of_speech'
  ) THEN
    ALTER TABLE grammarian_word_of_the_day ADD COLUMN part_of_speech text;
  END IF;
END $$;