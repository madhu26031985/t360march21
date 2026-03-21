/*
  # Fix Club References to Use Clubs Table

  ## Summary
  This migration fixes the club ID references throughout the database to use the clubs table
  instead of club_profiles, resolving the foreign key constraint issue when creating meetings.

  ## Issue
  The app_club_meeting table has a foreign key constraint that references clubs(id),
  but app_club_user_relationship.club_id references club_profiles.id.
  club_profiles and clubs have duplicate entries with different IDs but same club_number.

  ## Changes
  1. Update app_club_user_relationship.club_id to reference clubs.id
  2. Update any meetings that might reference club_profiles.id
  3. Create mapping based on club_number since that's the common identifier

  ## Security
  No RLS changes needed
*/

-- Update app_club_user_relationship to use clubs.id instead of club_profiles.id
UPDATE app_club_user_relationship acur
SET club_id = c.id
FROM club_profiles cp
JOIN clubs c ON c.club_number = cp.club_number
WHERE acur.club_id = cp.id
  AND cp.id != c.id
  AND c.club_number IS NOT NULL;

-- Update any meetings that might reference club_profiles.id
UPDATE app_club_meeting acm
SET club_id = c.id
FROM club_profiles cp
JOIN clubs c ON c.club_number = cp.club_number
WHERE acm.club_id = cp.id
  AND cp.id != c.id
  AND c.club_number IS NOT NULL;
