/*
  # Manage Table Topic Questions on Role Change

  1. Purpose
    - Automatically deactivate Table Topic Master questions when they withdraw from the role
    - Automatically reactivate their questions when they book the role again
    - Ensures clean slate for new Table Topic Masters

  2. Changes
    - Create trigger function to manage question visibility based on role booking status
    - Add trigger on app_meeting_roles_management for Table Topic Master role changes

  3. Behavior
    - When TT Master withdraws (status changes to 'cancelled' or 'available'):
      - Set all their questions to is_active = false
    - When TT Master books role (status changes to 'booked'):
      - Set all their questions back to is_active = true
*/

-- Create function to manage table topic questions on role change
CREATE OR REPLACE FUNCTION manage_table_topic_questions_on_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if this is a Table Topic Master role
  IF NEW.role_name ILIKE '%Table Topic Master%' OR NEW.role_name ILIKE '%Table Topics Master%' THEN
    
    -- When role is unbooked/withdrawn (new status is cancelled or available)
    IF NEW.booking_status IN ('cancelled', 'available') AND OLD.booking_status = 'booked' THEN
      -- Deactivate all questions created by this user for this meeting
      UPDATE app_meeting_tabletopicscorner
      SET is_active = false
      WHERE meeting_id = NEW.meeting_id
        AND table_topic_master_user_id = OLD.assigned_user_id
        AND is_active = true;
      
      RAISE NOTICE 'Deactivated questions for TT Master % in meeting %', OLD.assigned_user_id, NEW.meeting_id;
    END IF;
    
    -- When role is booked (new status is booked)
    IF NEW.booking_status = 'booked' AND OLD.booking_status IN ('cancelled', 'available') THEN
      -- Reactivate all questions created by this user for this meeting
      UPDATE app_meeting_tabletopicscorner
      SET is_active = true
      WHERE meeting_id = NEW.meeting_id
        AND table_topic_master_user_id = NEW.assigned_user_id
        AND is_active = false;
      
      RAISE NOTICE 'Reactivated questions for TT Master % in meeting %', NEW.assigned_user_id, NEW.meeting_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_manage_table_topic_questions ON app_meeting_roles_management;

-- Create trigger on app_meeting_roles_management
CREATE TRIGGER trigger_manage_table_topic_questions
  AFTER UPDATE OF booking_status ON app_meeting_roles_management
  FOR EACH ROW
  WHEN (OLD.booking_status IS DISTINCT FROM NEW.booking_status)
  EXECUTE FUNCTION manage_table_topic_questions_on_role_change();