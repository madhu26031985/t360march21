/*
  # Drop Unused club_invitations Table

  1. Changes
    - Drop the `club_invitations` table which is not used anywhere in the product
    - The product uses `app_user_invitation` table instead for all invitation functionality
  
  2. Rationale
    - This table exists but has no references in the codebase
    - All invitation logic uses `app_user_invitation` table
    - Cleaning up unused database objects
  
  3. Impact
    - No impact on existing functionality
    - Table is empty and unused
*/

-- Drop the unused club_invitations table
DROP TABLE IF EXISTS club_invitations CASCADE;
