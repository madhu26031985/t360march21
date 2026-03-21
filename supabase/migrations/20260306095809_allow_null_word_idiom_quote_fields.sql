/*
  # Allow null values for word, idiom, and quote fields

  ## Changes
  - Makes `word` column nullable in `grammarian_word_of_the_day`
  - Makes `idiom` column nullable in `grammarian_idiom_of_the_day`
  - Makes `quote` column nullable in `grammarian_quote_of_the_day`

  ## Reason
  Users should be able to clear/save these fields without a value.
  The `is_published` flag already controls visibility.
*/

ALTER TABLE grammarian_word_of_the_day ALTER COLUMN word DROP NOT NULL;
ALTER TABLE grammarian_idiom_of_the_day ALTER COLUMN idiom DROP NOT NULL;
ALTER TABLE grammarian_quote_of_the_day ALTER COLUMN quote DROP NOT NULL;
