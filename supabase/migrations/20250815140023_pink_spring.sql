/*
  # Drop club_chat_messages table

  1. Tables Removed
    - `club_chat_messages` - Remove chat functionality table

  2. Security
    - Remove all RLS policies associated with the table
    - Remove all triggers and functions if any

  3. Dependencies
    - Remove any foreign key constraints
    - Clean up any dependent objects
*/

-- Drop the club_chat_messages table if it exists
DROP TABLE IF EXISTS club_chat_messages CASCADE;

-- Note: CASCADE will automatically drop any dependent objects like:
-- - Foreign key constraints
-- - Indexes
-- - Triggers
-- - RLS policies
-- - Views that depend on this table