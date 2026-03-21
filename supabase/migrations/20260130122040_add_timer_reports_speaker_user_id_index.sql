/*
  # Add Index for Timer Reports Speaker Queries

  1. Performance Optimization
    - Add index on `speaker_user_id` column in `timer_reports` table
    - This improves query performance when filtering timer reports by speaker
    - Used by the My Timer Records screen to quickly find all records for a specific user

  2. Changes
    - CREATE INDEX on timer_reports(speaker_user_id)
*/

-- Add index for speaker_user_id to improve query performance
CREATE INDEX IF NOT EXISTS idx_timer_reports_speaker_user_id ON timer_reports(speaker_user_id);
