/*
  # Add General Evaluator Report Sub-Roles Structure

  ## Summary
  Creates a structure to track individual sub-roles within the General Evaluator Report section,
  including Evaluators 1-3, Tag Team, Timer, Ah-Counter, Grammarian, and the GE Summary.

  ## Changes

  1. **Create `ge_report_sub_roles` table**
     - Stores individual sub-roles for GE Report section
     - Links to meeting_agenda_items via `agenda_item_id`
     - Tracks role name, assigned user, duration, and order

  2. **Security**
     - Enable RLS
     - Club members can view sub-roles
     - Excomm can manage sub-roles

  ## Security
    - RLS policies for viewing and managing sub-roles
*/

-- Create table for GE Report sub-roles
CREATE TABLE IF NOT EXISTS ge_report_sub_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_item_id UUID REFERENCES meeting_agenda_items(id) ON DELETE CASCADE NOT NULL,
  meeting_id UUID REFERENCES app_club_meeting(id) ON DELETE CASCADE NOT NULL,
  club_id UUID REFERENCES club_profiles(id) ON DELETE CASCADE NOT NULL,
  
  sub_role_name TEXT NOT NULL,
  sub_role_type TEXT NOT NULL, -- 'evaluator', 'tag_team', 'timer', 'ah_counter', 'grammarian', 'ge_summary'
  sub_role_order INTEGER NOT NULL,
  
  assigned_user_id UUID REFERENCES app_user_profiles(id) ON DELETE SET NULL,
  assigned_user_name TEXT,
  duration_minutes INTEGER DEFAULT 3,
  
  -- Link to actual role if applicable (e.g., Timer role in meeting)
  linked_role_id UUID REFERENCES app_meeting_roles_management(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(agenda_item_id, sub_role_order)
);

ALTER TABLE ge_report_sub_roles ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ge_sub_roles_agenda_item ON ge_report_sub_roles(agenda_item_id);
CREATE INDEX IF NOT EXISTS idx_ge_sub_roles_meeting ON ge_report_sub_roles(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ge_sub_roles_club ON ge_report_sub_roles(club_id);

-- RLS Policies
CREATE POLICY "Club members can view GE sub-roles"
  ON ge_report_sub_roles
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "Excomm can manage GE sub-roles"
  ON ge_report_sub_roles
  FOR ALL
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() 
      AND is_authenticated = true 
      AND role IN ('excomm', 'club_leader')
    )
  )
  WITH CHECK (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() 
      AND is_authenticated = true 
      AND role IN ('excomm', 'club_leader')
    )
  );

-- Function to auto-create GE sub-roles when GE Report agenda item is created/updated
CREATE OR REPLACE FUNCTION create_ge_report_sub_roles()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create sub-roles for "General Evaluator Report" section
  IF NEW.section_name = 'General Evaluator Report' THEN
    -- Delete existing sub-roles for this agenda item
    DELETE FROM ge_report_sub_roles WHERE agenda_item_id = NEW.id;
    
    -- Create default sub-roles
    INSERT INTO ge_report_sub_roles (
      agenda_item_id,
      meeting_id,
      club_id,
      sub_role_name,
      sub_role_type,
      sub_role_order,
      duration_minutes
    ) VALUES
      (NEW.id, NEW.meeting_id, NEW.club_id, 'Evaluator 1', 'evaluator', 1, 3),
      (NEW.id, NEW.meeting_id, NEW.club_id, 'Evaluator 2', 'evaluator', 2, 3),
      (NEW.id, NEW.meeting_id, NEW.club_id, 'Evaluator 3', 'evaluator', 3, 3),
      (NEW.id, NEW.meeting_id, NEW.club_id, 'Tag Team Report', 'tag_team', 4, 0),
      (NEW.id, NEW.meeting_id, NEW.club_id, 'Timer Report', 'timer', 5, 2),
      (NEW.id, NEW.meeting_id, NEW.club_id, 'Ah-Counter Report', 'ah_counter', 6, 2),
      (NEW.id, NEW.meeting_id, NEW.club_id, 'Grammarian Report', 'grammarian', 7, 2),
      (NEW.id, NEW.meeting_id, NEW.club_id, 'Overall Meeting Summary', 'ge_summary', 8, 0);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-creating GE sub-roles
DROP TRIGGER IF EXISTS trigger_create_ge_sub_roles ON meeting_agenda_items;
CREATE TRIGGER trigger_create_ge_sub_roles
  AFTER INSERT OR UPDATE ON meeting_agenda_items
  FOR EACH ROW
  EXECUTE FUNCTION create_ge_report_sub_roles();

-- Backdate: Create sub-roles for all existing GE Report sections (only for valid clubs)
DO $$
DECLARE
  v_ge_item RECORD;
BEGIN
  FOR v_ge_item IN 
    SELECT mai.id, mai.meeting_id, mai.club_id
    FROM meeting_agenda_items mai
    INNER JOIN club_profiles cp ON mai.club_id = cp.id
    WHERE mai.section_name = 'General Evaluator Report'
  LOOP
    -- Delete existing sub-roles if any
    DELETE FROM ge_report_sub_roles WHERE agenda_item_id = v_ge_item.id;
    
    -- Create default sub-roles
    INSERT INTO ge_report_sub_roles (
      agenda_item_id,
      meeting_id,
      club_id,
      sub_role_name,
      sub_role_type,
      sub_role_order,
      duration_minutes
    ) VALUES
      (v_ge_item.id, v_ge_item.meeting_id, v_ge_item.club_id, 'Evaluator 1', 'evaluator', 1, 3),
      (v_ge_item.id, v_ge_item.meeting_id, v_ge_item.club_id, 'Evaluator 2', 'evaluator', 2, 3),
      (v_ge_item.id, v_ge_item.meeting_id, v_ge_item.club_id, 'Evaluator 3', 'evaluator', 3, 3),
      (v_ge_item.id, v_ge_item.meeting_id, v_ge_item.club_id, 'Tag Team Report', 'tag_team', 4, 0),
      (v_ge_item.id, v_ge_item.meeting_id, v_ge_item.club_id, 'Timer Report', 'timer', 5, 2),
      (v_ge_item.id, v_ge_item.meeting_id, v_ge_item.club_id, 'Ah-Counter Report', 'ah_counter', 6, 2),
      (v_ge_item.id, v_ge_item.meeting_id, v_ge_item.club_id, 'Grammarian Report', 'grammarian', 7, 2),
      (v_ge_item.id, v_ge_item.meeting_id, v_ge_item.club_id, 'Overall Meeting Summary', 'ge_summary', 8, 0);
  END LOOP;
END;
$$;
