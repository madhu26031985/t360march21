/*
  # Fix ExComm Review Policy for Metadata Fields
  
  ## Problem
  The current WITH CHECK clause only validates the status field, but the trigger
  needs to also set reviewed_at and reviewed_by. The WITH CHECK clause was too
  restrictive and blocked the trigger from setting these fields.
  
  ## Solution
  Remove the restrictive WITH CHECK clause entirely. The USING clause already
  ensures only ExComm can update, and only pending requests can be updated.
  The trigger (which runs as SECURITY DEFINER) will handle setting the metadata.
  
  ## Changes
  1. Drop the old policy
  2. Recreate without WITH CHECK clause
  3. This allows the trigger to freely set reviewed_at and reviewed_by
  
  ## Security
  - USING clause still restricts who can update (only ExComm)
  - USING clause still restricts what can be updated (only pending requests)
  - Trigger runs as SECURITY DEFINER to set metadata fields
*/

-- Drop the old policy
DROP POLICY IF EXISTS "excomm_can_review_requests" ON club_join_requests;

-- Recreate policy without WITH CHECK restriction
CREATE POLICY "excomm_can_review_requests"
  ON club_join_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.club_id = club_join_requests.club_id
        AND app_club_user_relationship.is_authenticated = true
        AND app_club_user_relationship.role IN ('excomm', 'president', 'vpe', 'vpm', 'vppr', 'secretary', 'treasurer', 'saa', 'ipp')
    )
    AND status = 'pending'
  );
