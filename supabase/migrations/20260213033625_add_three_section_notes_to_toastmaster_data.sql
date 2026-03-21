/*
  # Add Three Section Notes to Toastmaster Meeting Data

  1. Changes
    - Add `opening_notes` column (text, nullable) - 600 character limit
    - Add `mid_section_notes` column (text, nullable) - 600 character limit
    - Add `closure_notes` column (text, nullable) - 600 character limit
  
  2. Notes
    - These three fields replace the single `personal_notes` field
    - Each section has a 600 character limit enforced at the application level
    - Keeping `personal_notes` for backward compatibility
*/

-- Add three new note section columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'toastmaster_meeting_data' AND column_name = 'opening_notes'
  ) THEN
    ALTER TABLE toastmaster_meeting_data ADD COLUMN opening_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'toastmaster_meeting_data' AND column_name = 'mid_section_notes'
  ) THEN
    ALTER TABLE toastmaster_meeting_data ADD COLUMN mid_section_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'toastmaster_meeting_data' AND column_name = 'closure_notes'
  ) THEN
    ALTER TABLE toastmaster_meeting_data ADD COLUMN closure_notes text;
  END IF;
END $$;