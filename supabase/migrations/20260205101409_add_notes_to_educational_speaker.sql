/*
  # Add Notes Column to Educational Speaker

  1. Changes
    - Add `notes` column to `app_meeting_educational_speaker` table
    - Text type, nullable, for storing prep notes (max 1500 words)
    
  2. Purpose
    - Allows educational speakers to prepare and store notes for their presentation
    - Private prep space visible only to the assigned speaker
*/

-- Add notes column to app_meeting_educational_speaker table
ALTER TABLE app_meeting_educational_speaker 
ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN app_meeting_educational_speaker.notes IS 
  'Private notes for the educational speaker to prepare their presentation (max 1500 words)';
