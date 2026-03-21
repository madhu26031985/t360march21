/*
  # Fix Missing Invitation Trigger

  ## Issue
  The trigger that automatically accepts invitations and adds users to clubs
  when they sign up is missing from the database.

  ## Changes
  1. Recreate the trigger on app_user_profiles table
  2. Ensure the function link_pending_invitations_to_user() is called
  3. This trigger should fire AFTER INSERT on app_user_profiles

  ## How It Works
  - When a new user signs up, the trigger fires
  - It finds all pending invitations matching the user's email
  - Automatically accepts them and adds user to clubs
  - Sends notifications to the user
*/

-- Ensure the function exists (it already does but let's make sure)
CREATE OR REPLACE FUNCTION link_pending_invitations_to_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Loop through all pending invitations that match the user's email
  FOR invitation_record IN
    SELECT id, club_id, invitee_role
    FROM app_user_invitation
    WHERE invitee_email = NEW.email
      AND status = 'pending'
      AND expires_at > now()
      AND accepted_user_id IS NULL
  LOOP
    -- Update the invitation to accepted status
    UPDATE app_user_invitation
    SET 
      accepted_user_id = NEW.id,
      status = 'accepted',
      accepted_at = now(),
      updated_at = now()
    WHERE id = invitation_record.id;
    
    -- Add user to club with the invited role
    INSERT INTO app_club_user_relationship (
      user_id,
      club_id,
      role,
      is_authenticated,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      invitation_record.club_id,
      invitation_record.invitee_role,
      true,
      now(),
      now()
    )
    ON CONFLICT (user_id, club_id) DO UPDATE
    SET
      role = invitation_record.invitee_role,
      is_authenticated = true,
      updated_at = now();
    
    -- Send notification to the user
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      is_read,
      data
    )
    VALUES (
      NEW.id,
      'Welcome to the Club!',
      'You have been added to a club. Check your clubs to get started!',
      'club_added',
      false,
      jsonb_build_object(
        'club_id', invitation_record.club_id,
        'role', invitation_record.invitee_role
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trigger_link_pending_invitations ON app_user_profiles;

-- Create the trigger
CREATE TRIGGER trigger_link_pending_invitations
  AFTER INSERT ON app_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_pending_invitations_to_user();

COMMENT ON TRIGGER trigger_link_pending_invitations ON app_user_profiles IS 
'Automatically accepts pending invitations and adds new users to clubs when they sign up';
