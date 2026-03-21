/*
  # Implement Role-Based Access Control for Meeting Reports

  1. Security Policies
    - Timer reports: Only assigned Timer can create/edit
    - Ah Counter reports: Only assigned Ah Counter can create/edit  
    - Grammarian reports: Only assigned Grammarian can create/edit
    - All club members can read reports

  2. Database Functions
    - Helper functions to check role assignments
    - Audit logging for report modifications

  3. Triggers
    - Automatic audit trail creation
    - Role assignment validation
*/

-- Helper function to check if user is assigned to specific role for a meeting
CREATE OR REPLACE FUNCTION is_user_assigned_to_role(
  p_user_id uuid,
  p_meeting_id uuid,
  p_role_pattern text
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM app_meeting_roles_management 
    WHERE meeting_id = p_meeting_id 
    AND assigned_user_id = p_user_id
    AND role_name ILIKE p_role_pattern
    AND role_status = 'Available'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get assigned user for a role in a meeting
CREATE OR REPLACE FUNCTION get_assigned_user_for_role(
  p_meeting_id uuid,
  p_role_pattern text
) RETURNS uuid AS $$
DECLARE
  assigned_user uuid;
BEGIN
  SELECT assigned_user_id INTO assigned_user
  FROM app_meeting_roles_management 
  WHERE meeting_id = p_meeting_id 
  AND role_name ILIKE p_role_pattern
  AND role_status = 'Available'
  AND assigned_user_id IS NOT NULL
  LIMIT 1;
  
  RETURN assigned_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit logging function for report modifications
CREATE OR REPLACE FUNCTION log_report_modification()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_management_audit (
    action_type,
    target_user_id,
    performed_by,
    changes,
    created_at
  ) VALUES (
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'report_created'
      WHEN TG_OP = 'UPDATE' THEN 'report_updated'
      WHEN TG_OP = 'DELETE' THEN 'report_deleted'
    END,
    COALESCE(NEW.recorded_by, OLD.recorded_by),
    auth.uid(),
    jsonb_build_object(
      'report_type', TG_TABLE_NAME,
      'meeting_id', COALESCE(NEW.meeting_id, OLD.meeting_id),
      'operation', TG_OP,
      'timestamp', NOW()
    ),
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "timer_reports_crud_policy" ON timer_reports;
DROP POLICY IF EXISTS "timer_reports_read_policy" ON timer_reports;
DROP POLICY IF EXISTS "ah_counter_reports_crud_policy" ON ah_counter_reports;
DROP POLICY IF EXISTS "ah_counter_reports_read_policy" ON ah_counter_reports;
DROP POLICY IF EXISTS "grammarian_reports_crud_policy" ON grammarian_reports;
DROP POLICY IF EXISTS "grammarian_reports_read_policy" ON grammarian_reports;
DROP POLICY IF EXISTS "grammarian_word_usage_crud_policy" ON grammarian_word_usage;
DROP POLICY IF EXISTS "grammarian_good_usage_crud_policy" ON grammarian_good_usage;
DROP POLICY IF EXISTS "grammarian_suggestions_crud_policy" ON grammarian_suggestions;

-- Timer Reports Access Control
CREATE POLICY "timer_reports_crud_policy" ON timer_reports
FOR ALL USING (
  -- Only assigned Timer can create/edit/delete
  is_user_assigned_to_role(auth.uid(), meeting_id, '%timer%') AND
  recorded_by = auth.uid()
) WITH CHECK (
  is_user_assigned_to_role(auth.uid(), meeting_id, '%timer%') AND
  recorded_by = auth.uid()
);

CREATE POLICY "timer_reports_read_policy" ON timer_reports
FOR SELECT USING (
  -- All authenticated club members can read
  club_id IN (
    SELECT club_id FROM app_club_user_relationship 
    WHERE user_id = auth.uid() AND is_authenticated = true
  )
);

-- Ah Counter Reports Access Control  
CREATE POLICY "ah_counter_reports_crud_policy" ON ah_counter_reports
FOR ALL USING (
  -- Only assigned Ah Counter can create/edit/delete
  is_user_assigned_to_role(auth.uid(), meeting_id, '%ah%counter%') AND
  recorded_by = auth.uid()
) WITH CHECK (
  is_user_assigned_to_role(auth.uid(), meeting_id, '%ah%counter%') AND
  recorded_by = auth.uid()
);

CREATE POLICY "ah_counter_reports_read_policy" ON ah_counter_reports
FOR SELECT USING (
  -- All authenticated club members can read
  club_id IN (
    SELECT club_id FROM app_club_user_relationship 
    WHERE user_id = auth.uid() AND is_authenticated = true
  )
);

-- Grammarian Reports Access Control
CREATE POLICY "grammarian_reports_crud_policy" ON grammarian_reports
FOR ALL USING (
  -- Only assigned Grammarian can create/edit/delete
  is_user_assigned_to_role(auth.uid(), meeting_id, '%grammarian%') AND
  recorded_by = auth.uid()
) WITH CHECK (
  is_user_assigned_to_role(auth.uid(), meeting_id, '%grammarian%') AND
  recorded_by = auth.uid()
);

CREATE POLICY "grammarian_reports_read_policy" ON grammarian_reports
FOR SELECT USING (
  -- All authenticated club members can read
  club_id IN (
    SELECT club_id FROM app_club_user_relationship 
    WHERE user_id = auth.uid() AND is_authenticated = true
  )
);

-- Grammarian Word Usage Access Control
CREATE POLICY "grammarian_word_usage_crud_policy" ON grammarian_word_usage
FOR ALL USING (
  -- Only assigned Grammarian can create/edit/delete
  grammarian_report_id IN (
    SELECT id FROM grammarian_reports 
    WHERE recorded_by = auth.uid() AND
    is_user_assigned_to_role(auth.uid(), meeting_id, '%grammarian%')
  )
) WITH CHECK (
  grammarian_report_id IN (
    SELECT id FROM grammarian_reports 
    WHERE recorded_by = auth.uid() AND
    is_user_assigned_to_role(auth.uid(), meeting_id, '%grammarian%')
  )
);

-- Grammarian Good Usage Access Control
CREATE POLICY "grammarian_good_usage_crud_policy" ON grammarian_good_usage
FOR ALL USING (
  -- Only assigned Grammarian can create/edit/delete
  grammarian_report_id IN (
    SELECT id FROM grammarian_reports 
    WHERE recorded_by = auth.uid() AND
    is_user_assigned_to_role(auth.uid(), meeting_id, '%grammarian%')
  )
) WITH CHECK (
  grammarian_report_id IN (
    SELECT id FROM grammarian_reports 
    WHERE recorded_by = auth.uid() AND
    is_user_assigned_to_role(auth.uid(), meeting_id, '%grammarian%')
  )
);

-- Grammarian Suggestions Access Control
CREATE POLICY "grammarian_suggestions_crud_policy" ON grammarian_suggestions
FOR ALL USING (
  -- Only assigned Grammarian can create/edit/delete
  grammarian_report_id IN (
    SELECT id FROM grammarian_reports 
    WHERE recorded_by = auth.uid() AND
    is_user_assigned_to_role(auth.uid(), meeting_id, '%grammarian%')
  )
) WITH CHECK (
  grammarian_report_id IN (
    SELECT id FROM grammarian_reports 
    WHERE recorded_by = auth.uid() AND
    is_user_assigned_to_role(auth.uid(), meeting_id, '%grammarian%')
  )
);

-- Add audit triggers for all report tables
CREATE TRIGGER timer_reports_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON timer_reports
  FOR EACH ROW EXECUTE FUNCTION log_report_modification();

CREATE TRIGGER ah_counter_reports_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ah_counter_reports
  FOR EACH ROW EXECUTE FUNCTION log_report_modification();

CREATE TRIGGER grammarian_reports_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON grammarian_reports
  FOR EACH ROW EXECUTE FUNCTION log_report_modification();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_user_assigned_to_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_assigned_user_for_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION log_report_modification() TO authenticated;