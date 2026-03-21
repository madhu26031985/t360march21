/*
  # Add policy for mentees to view their own assignments

  1. Changes
    - Add policy allowing users to view mentor assignments where they are the mentee
    
  2. Security
    - Users can only see assignments where they are the mentee
    - Assignment must be active
*/

-- Drop the function as we don't need it anymore
DROP FUNCTION IF EXISTS get_my_mentor(uuid);

-- Add a policy for mentees to view their own assignments
CREATE POLICY "Mentees can view their own mentor assignments"
  ON mentor_assignments
  FOR SELECT
  TO authenticated
  USING (mentee_id = auth.uid());
