/*
  # Add selected item IDs to Grammarian Corner visibility table
  
  1. Changes
    - Add columns to store which specific word/quote/idiom is selected
    - This allows ExComm to pick from multiple published items
  
  2. New Columns
    - selected_word_id - references grammarian_word_of_the_day
    - selected_quote_id - references grammarian_quote_of_the_day
    - selected_idiom_id - references grammarian_idiom_of_the_day
*/

-- Add columns for selected items
ALTER TABLE grammarian_corner_visibility
ADD COLUMN IF NOT EXISTS selected_word_id uuid REFERENCES grammarian_word_of_the_day(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS selected_quote_id uuid REFERENCES grammarian_quote_of_the_day(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS selected_idiom_id uuid REFERENCES grammarian_idiom_of_the_day(id) ON DELETE SET NULL;
