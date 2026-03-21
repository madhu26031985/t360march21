/*
  # Fix Join Request Approval Workflow
  
  ## Problem
  The trigger was automatically adding users as 'guest' when status changed to 'approved',
  but the app now handles user addition manually through the invite workflow.
  This allows ExComm to choose the role.
  
  ## Changes
  1. Modify the trigger to ONLY set reviewed_at and reviewed_by
  2. Remove automatic user addition from trigger
  3. App code handles user addition with chosen role
  
  ## Security
  - Maintains RLS policies unchanged
  - Trigger still captures review metadata
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS handle_approved_join_request_trigger ON club_join_requests;

-- Recreate function without automatic user addition
CREATE OR REPLACE FUNCTION handle_approved_join_request()
RETURNS TRIGGER AS $$
BEGIN
  -- If request was approved or rejected, set reviewed info
  IF NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending' THEN
    NEW.reviewed_at = now();
    NEW.reviewed_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER handle_approved_join_request_trigger
  BEFORE UPDATE ON club_join_requests
  FOR EACH ROW
  WHEN (NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_approved_join_request();
