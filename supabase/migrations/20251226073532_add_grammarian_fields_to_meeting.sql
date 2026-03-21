/*
  # Add Grammarian Fields to Meeting Table
  
  ## Summary
  Adds phrase_of_the_day, idiom_of_the_day, and quote_of_the_day fields to the app_club_meeting
  table to complement the existing word_of_the_day field. These fields are set by the Grammarian
  and displayed in the Ancillary Speakers section of the meeting agenda.
  
  ## Changes
  1. Add phrase_of_the_day column to app_club_meeting
  2. Add idiom_of_the_day column to app_club_meeting
  3. Add quote_of_the_day column to app_club_meeting
  
  ## Security
    - No RLS changes needed (inherits existing meeting policies)
*/

-- Add grammarian fields to app_club_meeting table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_club_meeting' AND column_name = 'phrase_of_the_day'
  ) THEN
    ALTER TABLE app_club_meeting ADD COLUMN phrase_of_the_day text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_club_meeting' AND column_name = 'idiom_of_the_day'
  ) THEN
    ALTER TABLE app_club_meeting ADD COLUMN idiom_of_the_day text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_club_meeting' AND column_name = 'quote_of_the_day'
  ) THEN
    ALTER TABLE app_club_meeting ADD COLUMN quote_of_the_day text;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN app_club_meeting.phrase_of_the_day IS 'Phrase of the day set by the Grammarian for the meeting';
COMMENT ON COLUMN app_club_meeting.idiom_of_the_day IS 'Idiom of the day set by the Grammarian for the meeting';
COMMENT ON COLUMN app_club_meeting.quote_of_the_day IS 'Quote of the day set by the Grammarian for the meeting';