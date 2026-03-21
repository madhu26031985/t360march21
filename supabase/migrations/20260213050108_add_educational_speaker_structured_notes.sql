/*
  # Add Structured Notes for Educational Speaker
  
  1. New Columns
    - `opening_notes` (text, nullable) - Opening section notes (max 600 characters)
    - `mid_section_notes` (text, nullable) - Mid section notes (max 600 characters)
    - `closing_notes` (text, nullable) - Closing section notes (max 600 characters)
    
  2. Purpose
    - Split educational speaker prep notes into three structured sections
    - Similar to toastmaster notes structure
    - Each section limited to 600 characters for focused preparation
*/

-- Add structured notes columns to app_meeting_educational_speaker table
ALTER TABLE app_meeting_educational_speaker 
ADD COLUMN IF NOT EXISTS opening_notes text,
ADD COLUMN IF NOT EXISTS mid_section_notes text,
ADD COLUMN IF NOT EXISTS closing_notes text;

-- Add comments for documentation
COMMENT ON COLUMN app_meeting_educational_speaker.opening_notes IS 
  'Opening section notes for educational speaker (max 600 characters)';

COMMENT ON COLUMN app_meeting_educational_speaker.mid_section_notes IS 
  'Mid section notes for educational speaker (max 600 characters)';

COMMENT ON COLUMN app_meeting_educational_speaker.closing_notes IS 
  'Closing section notes for educational speaker (max 600 characters)';
