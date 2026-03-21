/*
  # Add Invitation Trigger for New Users

  1. Purpose
    - Automatically link pending invitations to users when they sign up
    - Update invitation status to show invites to newly authenticated users
    
  2. Changes
    - Create a trigger function that runs after user signup
    - The function updates the accepted_user_id for pending invitations matching the user's email
    - This allows invitations sent to unauthenticated users to automatically appear in their account
    
  3. Security
    - Function runs with security definer privileges
    - Only affects invitations with matching email addresses
    - Maintains data integrity by only updating pending invitations
*/

-- Create function to link pending invitations to newly registered users
CREATE OR REPLACE FUNCTION link_pending_invitations_to_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update any pending invitations that match the user's email
  UPDATE app_user_invitation
  SET 
    accepted_user_id = NEW.id,
    updated_at = now()
  WHERE 
    invitee_email = NEW.email
    AND status = 'pending'
    AND expires_at > now()
    AND accepted_user_id IS NULL;
    
  RETURN NEW;
END;
$$;

-- Create trigger that fires after a new user is inserted in app_user_profiles
DROP TRIGGER IF EXISTS trigger_link_pending_invitations ON app_user_profiles;

CREATE TRIGGER trigger_link_pending_invitations
  AFTER INSERT ON app_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_pending_invitations_to_user();

-- Add updated_at column to app_user_invitation if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_user_invitation' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE app_user_invitation 
    ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;