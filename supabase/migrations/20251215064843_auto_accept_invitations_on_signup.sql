/*
  # Auto-Accept Invitations on User Signup

  ## Overview
  Simplifies the invitation flow by automatically accepting pending invitations
  and adding users to clubs when they sign up with an invited email address.

  ## Changes
  1. Updates the link_pending_invitations_to_user() function to:
     - Automatically mark invitations as 'accepted'
     - Create club relationships with the invited role
     - Set accepted_at timestamp
  
  2. This eliminates the need for users to manually accept invitations
  
  ## Flow
  - ExComm invites user via email
  - User receives email and signs up
  - System automatically adds them to the club with specified role
  - No manual acceptance required
*/

-- Update function to auto-accept invitations and add users to clubs
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
