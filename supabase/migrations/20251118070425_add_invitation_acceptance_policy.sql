/*
  # Add Policy for Accepting Invitations

  1. Purpose
    - Allow users to create club relationships when they have a valid pending invitation
    - This ensures new users can accept invitations and join clubs
    
  2. Changes
    - Add a new INSERT policy that checks for valid pending invitations
    - Users can insert a relationship if they have a pending invitation for that club
    
  3. Security
    - Policy verifies the invitation exists
    - Checks invitation status is 'pending'
    - Validates invitation hasn't expired
    - Ensures user_id matches the authenticated user
*/

-- Drop existing policy if it exists to recreate with proper permissions
DROP POLICY IF EXISTS "Users can accept invitations" ON app_club_user_relationship;

-- Create policy to allow users to insert relationships when accepting invitations
CREATE POLICY "Users can accept invitations"
  ON app_club_user_relationship
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be inserting their own relationship
    user_id = auth.uid()
    AND (
      -- Either they're creating their own relationship directly
      user_id = auth.uid()
      OR
      -- Or they have a valid pending invitation
      EXISTS (
        SELECT 1 
        FROM app_user_invitation
        WHERE app_user_invitation.club_id = app_club_user_relationship.club_id
          AND (
            app_user_invitation.invitee_email = (
              SELECT email FROM app_user_profiles WHERE id = auth.uid()
            )
            OR app_user_invitation.accepted_user_id = auth.uid()
          )
          AND app_user_invitation.status = 'pending'
          AND app_user_invitation.expires_at > now()
      )
    )
  );
