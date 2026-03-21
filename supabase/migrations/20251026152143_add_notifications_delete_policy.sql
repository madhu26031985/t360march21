/*
  # Add DELETE policy for notifications

  1. Changes
    - Add RLS policy allowing users to delete their own notifications
  
  2. Security
    - Users can only delete notifications that belong to them (user_id = auth.uid())
*/

-- Drop policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND policyname = 'Users can delete their own notifications'
  ) THEN
    DROP POLICY "Users can delete their own notifications" ON notifications;
  END IF;
END $$;

-- Add DELETE policy for notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
