/*
  # Restore: Add Part of Speech Column
  
  1. Changes
    - Add `part_of_speech` column to `grammarian_word_of_the_day` table
    
  2. Details
    - Column type: text
    - Nullable: allows storing the grammatical part of speech for the word
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
