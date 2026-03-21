/*
  # Create Meeting Agenda Automation System

  ## Summary
  This migration creates a comprehensive agenda system that automatically populates meeting agendas
  based on role bookings, meeting details, and theme information. The system allows Excomm members
  to review and edit auto-generated agendas.

  ## Changes
  
  1. Add theme and word of the day to meetings table
    - `theme` - Meeting theme
    - `word_of_the_day` - Word of the day for the meeting
  
  2. Create `agenda_item_templates` table
    - Standard agenda sections that appear in every meeting
    - Configurable per club with default time allocations
    
  3. Create `meeting_agenda_items` table
    - Meeting-specific agenda items
    - Auto-populated from templates and role bookings
    - Editable by Excomm
    
  4. Security
    - RLS policies for club members to view
    - RLS policies for Excomm to edit
*/

-- Add theme and word of the day to meetings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_club_meeting' AND column_name = 'theme'
  ) THEN
    ALTER TABLE app_club_meeting ADD COLUMN theme TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_club_meeting' AND column_name = 'word_of_the_day'
  ) THEN
    ALTER TABLE app_club_meeting ADD COLUMN word_of_the_day TEXT;
  END IF;
END $$;

-- Create agenda item templates table
CREATE TABLE IF NOT EXISTS agenda_item_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES club_profiles(id) ON DELETE CASCADE,
  section_name TEXT NOT NULL,
  section_description TEXT,
  section_icon TEXT,
  section_order INTEGER NOT NULL,
  default_duration_minutes INTEGER,
  is_role_based BOOLEAN DEFAULT false,
  role_classification TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agenda_item_templates ENABLE ROW LEVEL SECURITY;

-- Create meeting agenda items table
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES app_club_meeting(id) ON DELETE CASCADE NOT NULL,
  club_id UUID REFERENCES club_profiles(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES agenda_item_templates(id) ON DELETE SET NULL,
  section_name TEXT NOT NULL,
  section_description TEXT,
  section_icon TEXT,
  section_order INTEGER NOT NULL,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER,
  assigned_role_id UUID REFERENCES app_meeting_roles_management(id) ON DELETE SET NULL,
  assigned_user_id UUID REFERENCES app_user_profiles(id) ON DELETE SET NULL,
  assigned_user_name TEXT,
  role_details JSONB,
  is_auto_generated BOOLEAN DEFAULT true,
  custom_notes TEXT,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;

-- Insert default agenda item templates (only if not exists)
INSERT INTO agenda_item_templates (section_name, section_description, section_icon, section_order, default_duration_minutes, is_role_based, role_classification)
SELECT * FROM (VALUES
  ('Meet and Greet', 'Informal networking and socializing before the meeting begins', '🤝', 1, 15, false, NULL),
  ('Call to Order', 'Sergeant-at-Arms opens the meeting and explains ground rules', '🔔', 2, 5, true, 'sergeant_at_arms'),
  ('Presiding Officer Address', 'Welcome address and club updates from the President', '👋', 3, 5, true, 'presiding_officer'),
  ('Toastmaster of the Day', 'TMOD introduces the theme and sets the tone for the meeting', '🎭', 4, 5, true, 'toastmaster_of_the_day'),
  ('Prepared Speeches Session', 'Members deliver prepared speeches (5-7 minutes each)', '✏️', 5, 30, true, 'prepared_speaker'),
  ('Table Topics Session', 'Impromptu speaking session led by Table Topics Master', '💭', 6, 20, true, 'table_topics_master'),
  ('Evaluation Session', 'Speech evaluations and reports from functional role players', '📝', 7, 25, true, 'evaluation'),
  ('General Evaluator Report', 'GE provides overall meeting evaluation', '📊', 8, 5, true, 'general_evaluator'),
  ('Voting', 'Members vote for best speaker, evaluator, and table topics', '🗳️', 9, 10, true, 'voting_coordinator'),
  ('Awards', 'Announce winners and recognize achievements', '🏆', 10, 10, true, 'presiding_officer'),
  ('Closing Remarks', 'Closing remarks and adjournment', '👋', 11, 5, true, 'presiding_officer')
) AS v(section_name, section_description, section_icon, section_order, default_duration_minutes, is_role_based, role_classification)
WHERE NOT EXISTS (
  SELECT 1 FROM agenda_item_templates WHERE section_name = v.section_name AND club_id IS NULL
);

-- RLS Policies for agenda_item_templates
CREATE POLICY "Club members can view agenda templates"
  ON agenda_item_templates
  FOR SELECT
  TO authenticated
  USING (
    club_id IS NULL OR
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "Excomm can manage agenda templates"
  ON agenda_item_templates
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

-- RLS Policies for meeting_agenda_items
CREATE POLICY "Club members can view meeting agenda items"
  ON meeting_agenda_items
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "Excomm can manage meeting agenda items"
  ON meeting_agenda_items
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agenda_templates_club ON agenda_item_templates(club_id);
CREATE INDEX IF NOT EXISTS idx_agenda_templates_order ON agenda_item_templates(section_order);
CREATE INDEX IF NOT EXISTS idx_meeting_agenda_meeting ON meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_agenda_club ON meeting_agenda_items(club_id);
CREATE INDEX IF NOT EXISTS idx_meeting_agenda_order ON meeting_agenda_items(section_order);

-- Add comments
COMMENT ON TABLE agenda_item_templates IS 'Template agenda sections that can be customized per club';
COMMENT ON TABLE meeting_agenda_items IS 'Meeting-specific agenda items, auto-populated and editable by Excomm';
COMMENT ON COLUMN app_club_meeting.theme IS 'Meeting theme (e.g., "The Art of Story Telling")';
COMMENT ON COLUMN app_club_meeting.word_of_the_day IS 'Word of the day for the meeting';
