/*
  # Add Ice Breaker Category to Timer Reports

  1. Changes
    - Drop existing check constraint for speech_category
    - Add new check constraint that includes 'ice_breaker' as a valid category
  
  2. Valid Categories
    - table_topic_speaker
    - prepared_speaker
    - ice_breaker (NEW)
    - evaluation
    - educational_session
*/

-- Drop the existing constraint
ALTER TABLE timer_reports DROP CONSTRAINT IF EXISTS chk_timer_reports_valid_category;

-- Add new constraint with ice_breaker included
ALTER TABLE timer_reports ADD CONSTRAINT chk_timer_reports_valid_category 
  CHECK (speech_category IN ('table_topic_speaker', 'prepared_speaker', 'ice_breaker', 'evaluation', 'educational_session'));