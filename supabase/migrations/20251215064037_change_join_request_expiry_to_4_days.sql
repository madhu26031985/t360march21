/*
  # Change Join Request Expiry to 4 Days

  ## Overview
  Updates the club join requests expiry time from 24 hours to 4 days
  to give ExComm more time to review and manually add members.

  ## Changes
  1. Update default expires_at to 4 days (96 hours) for new requests
  2. Update existing pending requests to reflect 4 day expiry
*/

-- Update the default expiry time for new requests to 4 days
ALTER TABLE club_join_requests 
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '4 days');

-- Update existing pending requests that haven't expired yet
-- Extend their expiry to 4 days from creation date
UPDATE club_join_requests
SET expires_at = created_at + interval '4 days',
    updated_at = now()
WHERE status = 'pending'
  AND expires_at > now();
