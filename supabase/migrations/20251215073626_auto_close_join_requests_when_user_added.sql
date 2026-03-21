/*
  # Auto-Close Join Requests When User Added to Club

  ## Overview
  Automatically marks join requests as 'approved' when a user is added to a club
  through any method (invitation acceptance, manual addition, etc.)

  ## Changes
  1. Create trigger function to detect when user is added to club
  2. Automatically update any pending join requests to 'approved' status
  3. This keeps join requests in sync with actual club membership

  ## Flow
  - User has pending join request for Club A
  - ExComm adds user to Club A (via any method)
  - System automatically marks join request as 'approved'
  - Request moves to "Closed" section automatically
*/

-- Function to auto-close join requests when user added to club
CREATE OR REPLACE FUNCTION auto_close_join_request_on_user_add()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user is added to a club, mark their pending join request as approved
  UPDATE club_join_requests
  SET 
    status = 'approved',
    reviewed_at = now(),
    updated_at = now()
  WHERE user_id = NEW.user_id
    AND club_id = NEW.club_id
    AND status = 'pending';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on app_club_user_relationship
DROP TRIGGER IF EXISTS trigger_auto_close_join_request ON app_club_user_relationship;

CREATE TRIGGER trigger_auto_close_join_request
  AFTER INSERT ON app_club_user_relationship
  FOR EACH ROW
  EXECUTE FUNCTION auto_close_join_request_on_user_add();

-- Add comment for documentation
COMMENT ON FUNCTION auto_close_join_request_on_user_add() IS 
'Automatically marks pending join requests as approved when user is added to the club through any method';
