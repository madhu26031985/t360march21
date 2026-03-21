/*
  # Fix Invitation Trigger - Remove Notifications Insert
  
  ## Summary
  Fixes the signup error by updating the link_pending_invitations_to_user() function
  to remove the code that tries to insert into the non-existent notifications table.
  
  ## Problem
  The function was trying to insert into the notifications table which was removed
  in migration 20251226023447_remove_notification_system.sql, causing "Database error 
  saving new user" during signup.
  
  ## Changes
  - Update link_pending_invitations_to_user() function
  - Remove the INSERT INTO notifications statement
  - Keep all other functionality intact (accepting invitations, adding to clubs)
  
  ## Security
  - No RLS changes needed
  - Function remains SECURITY DEFINER as required
*/

CREATE OR REPLACE FUNCTION public.link_pending_invitations_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      
    -- Note: Notification system has been removed, no longer sending notifications
  END LOOP;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.link_pending_invitations_to_user() IS 
  'Automatically accepts pending invitations when a new user signs up with matching email. Updated to remove notifications system.';
