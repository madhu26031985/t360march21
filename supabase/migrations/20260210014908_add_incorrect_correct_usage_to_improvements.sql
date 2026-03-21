/*
  # Add Incorrect and Correct Usage Fields to Live Improvements

  1. Changes
    - Add `incorrect_usage` column to store the incorrect language usage example
    - Add `correct_usage` column to store the correct alternative
    - Make `observation` column nullable for backward compatibility
    - These fields enable structured grammar feedback with before/after examples
  
  2. Notes
    - Existing records will have NULL for new fields
    - New records should use incorrect_usage and correct_usage fields
    - The observation field is kept for potential backward compatibility
*/

-- Add incorrect_usage column
ALTER TABLE grammarian_live_improvements 
ADD COLUMN IF NOT EXISTS incorrect_usage TEXT;

-- Add correct_usage column
ALTER TABLE grammarian_live_improvements 
ADD COLUMN IF NOT EXISTS correct_usage TEXT;

-- Make observation nullable since we're moving to the new fields
ALTER TABLE grammarian_live_improvements 
ALTER COLUMN observation DROP NOT NULL;
