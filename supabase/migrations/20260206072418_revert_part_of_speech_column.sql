/*
  # Revert: Remove Part of Speech Column
  
  1. Changes
    - Remove `part_of_speech` column from `grammarian_word_of_the_day` table
    
  2. Reason
    - Reverting the add_part_of_speech_to_word_of_the_day migration
    - This change was breaking the live product
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammarian_word_of_the_day' AND column_name = 'part_of_speech'
  ) THEN
    ALTER TABLE grammarian_word_of_the_day DROP COLUMN part_of_speech;
  END IF;
END $$;
