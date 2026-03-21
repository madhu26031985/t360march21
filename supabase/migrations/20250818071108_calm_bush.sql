/*
  # Create Individual User Goals Tracking

  1. New Tables
    - `user_goals`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to app_user_profiles)
      - `club_id` (uuid, foreign key to clubs via app_club_user_relationship)
      - `goal_period_start` (date)
      - `goal_period_end` (date)
      - `goal_statement` (text, up to 500 characters)
      - Individual goal fields for all 11 categories
      - `status` (active, completed, archived)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `user_goal_progress`
      - `id` (uuid, primary key)
      - `goal_id` (uuid, foreign key to user_goals)
      - `user_id` (uuid, foreign key to app_user_profiles)
      - Progress tracking fields for all goal types
      - `last_updated` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Users can manage their own goals
    - Club members can view goals within their club

  3. Automation
    - Auto-initialize progress when goal is created
    - Auto-update timestamps
    - Sync progress from performance metrics
*/

-- Create user_goals table for individual goal tracking
CREATE TABLE IF NOT EXISTS user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  club_id uuid NOT NULL,
  goal_period_start date NOT NULL,
  goal_period_end date NOT NULL,
  goal_statement text DEFAULT '',
  
  -- Speaking Skills Goals
  meetings_to_attend integer DEFAULT 0,
  speeches_to_deliver integer DEFAULT 0,
  evaluations_to_give integer DEFAULT 0,
  table_topics_participation integer DEFAULT 0,
  
  -- Leadership Skills Goals
  tag_team_roles integer DEFAULT 0,
  tmod_roles integer DEFAULT 0,
  general_evaluator_roles integer DEFAULT 0,
  table_topics_master_roles integer DEFAULT 0,
  educational_sessions integer DEFAULT 0,
  other_leadership_roles integer DEFAULT 0,
  
  -- Learning & Growth Goals
  pathways_projects integer DEFAULT 0,
  
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_user_goals_period_valid CHECK (goal_period_end > goal_period_start),
  CONSTRAINT chk_user_goals_statement_length CHECK (length(goal_statement) <= 500),
  CONSTRAINT chk_user_goals_positive_values CHECK (
    meetings_to_attend >= 0 AND
    speeches_to_deliver >= 0 AND
    evaluations_to_give >= 0 AND
    table_topics_participation >= 0 AND
    tag_team_roles >= 0 AND
    tmod_roles >= 0 AND
    general_evaluator_roles >= 0 AND
    table_topics_master_roles >= 0 AND
    educational_sessions >= 0 AND
    other_leadership_roles >= 0 AND
    pathways_projects >= 0
  )
);

-- Create user_goal_progress table for tracking actual progress
CREATE TABLE IF NOT EXISTS user_goal_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL,
  user_id uuid NOT NULL,
  
  -- Speaking Skills Progress
  meetings_attended integer DEFAULT 0,
  speeches_delivered integer DEFAULT 0,
  evaluations_given integer DEFAULT 0,
  table_topics_participated integer DEFAULT 0,
  
  -- Leadership Skills Progress
  tag_team_roles_completed integer DEFAULT 0,
  tmod_roles_completed integer DEFAULT 0,
  general_evaluator_roles_completed integer DEFAULT 0,
  table_topics_master_roles_completed integer DEFAULT 0,
  educational_sessions_delivered integer DEFAULT 0,
  other_leadership_roles_completed integer DEFAULT 0,
  
  -- Learning & Growth Progress
  pathways_projects_completed integer DEFAULT 0,
  
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_user_goal_progress_positive_values CHECK (
    meetings_attended >= 0 AND
    speeches_delivered >= 0 AND
    evaluations_given >= 0 AND
    table_topics_participated >= 0 AND
    tag_team_roles_completed >= 0 AND
    tmod_roles_completed >= 0 AND
    general_evaluator_roles_completed >= 0 AND
    table_topics_master_roles_completed >= 0 AND
    educational_sessions_delivered >= 0 AND
    other_leadership_roles_completed >= 0 AND
    pathways_projects_completed >= 0
  )
);

-- Add foreign key constraints
ALTER TABLE user_goals 
ADD CONSTRAINT user_goals_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

ALTER TABLE user_goals 
ADD CONSTRAINT user_goals_club_id_fkey 
FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

ALTER TABLE user_goal_progress 
ADD CONSTRAINT user_goal_progress_goal_id_fkey 
FOREIGN KEY (goal_id) REFERENCES user_goals(id) ON DELETE CASCADE;

ALTER TABLE user_goal_progress 
ADD CONSTRAINT user_goal_progress_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_club_id ON user_goals(club_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_status ON user_goals(status);
CREATE INDEX IF NOT EXISTS idx_user_goals_period ON user_goals(goal_period_start, goal_period_end);
CREATE INDEX IF NOT EXISTS idx_user_goal_progress_goal_id ON user_goal_progress(goal_id);
CREATE INDEX IF NOT EXISTS idx_user_goal_progress_user_id ON user_goal_progress(user_id);

-- Enable Row Level Security
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goal_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_goals
CREATE POLICY "Users can manage their own goals"
  ON user_goals
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Club members can view goals within their club"
  ON user_goals
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

-- RLS Policies for user_goal_progress
CREATE POLICY "Users can manage their own goal progress"
  ON user_goal_progress
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Club members can view goal progress within their club"
  ON user_goal_progress
  FOR SELECT
  TO authenticated
  USING (
    goal_id IN (
      SELECT id 
      FROM user_goals 
      WHERE club_id IN (
        SELECT club_id 
        FROM app_club_user_relationship 
        WHERE user_id = auth.uid() AND is_authenticated = true
      )
    )
  );

-- Create function to auto-initialize goal progress
CREATE OR REPLACE FUNCTION initialize_goal_progress()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_goal_progress (
    goal_id,
    user_id,
    meetings_attended,
    speeches_delivered,
    evaluations_given,
    table_topics_participated,
    tag_team_roles_completed,
    tmod_roles_completed,
    general_evaluator_roles_completed,
    table_topics_master_roles_completed,
    educational_sessions_delivered,
    other_leadership_roles_completed,
    pathways_projects_completed
  ) VALUES (
    NEW.id,
    NEW.user_id,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-initialize progress
CREATE TRIGGER trigger_initialize_goal_progress
  AFTER INSERT ON user_goals
  FOR EACH ROW
  EXECUTE FUNCTION initialize_goal_progress();

-- Create function to update goal progress timestamps
CREATE OR REPLACE FUNCTION update_user_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_user_goals_updated_at
  BEFORE UPDATE ON user_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_user_goals_updated_at();

-- Create function to sync progress from performance metrics
CREATE OR REPLACE FUNCTION sync_goal_progress_from_metrics()
RETURNS TRIGGER AS $$
DECLARE
  goal_record RECORD;
  progress_record RECORD;
BEGIN
  -- Find active goals for this user
  FOR goal_record IN 
    SELECT id, user_id, club_id, goal_period_start, goal_period_end
    FROM user_goals 
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) 
    AND status = 'active'
    AND goal_period_start <= CURRENT_DATE 
    AND goal_period_end >= CURRENT_DATE
  LOOP
    -- Get current progress record
    SELECT * INTO progress_record
    FROM user_goal_progress 
    WHERE goal_id = goal_record.id;
    
    IF FOUND THEN
      -- Update progress based on performance metrics within goal period
      UPDATE user_goal_progress SET
        meetings_attended = COALESCE((
          SELECT COUNT(*)
          FROM user_performance_metrics 
          WHERE user_id = goal_record.user_id 
          AND metric_type = 'meetings_attended'
          AND meeting_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        speeches_delivered = COALESCE((
          SELECT COUNT(*)
          FROM user_performance_metrics 
          WHERE user_id = goal_record.user_id 
          AND metric_type = 'speeches_delivered'
          AND meeting_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        evaluations_given = COALESCE((
          SELECT COUNT(*)
          FROM user_performance_metrics 
          WHERE user_id = goal_record.user_id 
          AND metric_type = 'evaluations_given'
          AND meeting_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        table_topics_participated = COALESCE((
          SELECT COUNT(*)
          FROM user_performance_metrics 
          WHERE user_id = goal_record.user_id 
          AND metric_type = 'table_topics_participated'
          AND meeting_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        tag_team_roles_completed = COALESCE((
          SELECT COUNT(*)
          FROM user_performance_metrics 
          WHERE user_id = goal_record.user_id 
          AND metric_type = 'roles_completed'
          AND display_name IN ('Timer', 'Ah-Counter', 'Grammarian', 'Word Master', 'Joke Master')
          AND meeting_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        tmod_roles_completed = COALESCE((
          SELECT COUNT(*)
          FROM user_performance_metrics 
          WHERE user_id = goal_record.user_id 
          AND metric_type = 'roles_completed'
          AND display_name ILIKE '%toastmaster%'
          AND meeting_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        general_evaluator_roles_completed = COALESCE((
          SELECT COUNT(*)
          FROM user_performance_metrics 
          WHERE user_id = goal_record.user_id 
          AND metric_type = 'roles_completed'
          AND display_name ILIKE '%general evaluator%'
          AND meeting_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        table_topics_master_roles_completed = COALESCE((
          SELECT COUNT(*)
          FROM user_performance_metrics 
          WHERE user_id = goal_record.user_id 
          AND metric_type = 'roles_completed'
          AND display_name ILIKE '%table topics master%'
          AND meeting_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        educational_sessions_delivered = COALESCE((
          SELECT COUNT(*)
          FROM user_performance_metrics 
          WHERE user_id = goal_record.user_id 
          AND metric_type = 'roles_completed'
          AND display_name ILIKE '%education%'
          AND meeting_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        other_leadership_roles_completed = COALESCE((
          SELECT COUNT(*)
          FROM user_performance_metrics 
          WHERE user_id = goal_record.user_id 
          AND metric_type = 'roles_completed'
          AND display_name IN ('Presiding Officer', 'SAA', 'Listener', 'Guest Introducer')
          AND meeting_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        pathways_projects_completed = COALESCE((
          SELECT COUNT(*)
          FROM pathway_projects 
          WHERE user_id = goal_record.user_id 
          AND status = 'completed'
          AND end_date BETWEEN goal_record.goal_period_start AND goal_record.goal_period_end
        ), 0),
        
        last_updated = now()
      WHERE goal_id = goal_record.id;
    END IF;
  END LOOP;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to sync progress when performance metrics change
CREATE TRIGGER trigger_sync_goal_progress_on_metrics_change
  AFTER INSERT OR UPDATE OR DELETE ON user_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION sync_goal_progress_from_metrics();

CREATE TRIGGER trigger_sync_goal_progress_on_pathway_change
  AFTER INSERT OR UPDATE OR DELETE ON pathway_projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_goal_progress_from_metrics();

-- Create comprehensive view for goals with progress
CREATE OR REPLACE VIEW user_goals_with_progress AS
SELECT 
  g.id,
  g.user_id,
  g.club_id,
  g.goal_period_start,
  g.goal_period_end,
  g.goal_statement,
  g.status,
  g.created_at,
  g.updated_at,
  
  -- Goal targets
  g.meetings_to_attend,
  g.speeches_to_deliver,
  g.evaluations_to_give,
  g.table_topics_participation,
  g.tag_team_roles,
  g.tmod_roles,
  g.general_evaluator_roles,
  g.table_topics_master_roles,
  g.educational_sessions,
  g.other_leadership_roles,
  g.pathways_projects,
  
  -- Current progress
  COALESCE(p.meetings_attended, 0) as meetings_attended,
  COALESCE(p.speeches_delivered, 0) as speeches_delivered,
  COALESCE(p.evaluations_given, 0) as evaluations_given,
  COALESCE(p.table_topics_participated, 0) as table_topics_participated,
  COALESCE(p.tag_team_roles_completed, 0) as tag_team_roles_completed,
  COALESCE(p.tmod_roles_completed, 0) as tmod_roles_completed,
  COALESCE(p.general_evaluator_roles_completed, 0) as general_evaluator_roles_completed,
  COALESCE(p.table_topics_master_roles_completed, 0) as table_topics_master_roles_completed,
  COALESCE(p.educational_sessions_delivered, 0) as educational_sessions_delivered,
  COALESCE(p.other_leadership_roles_completed, 0) as other_leadership_roles_completed,
  COALESCE(p.pathways_projects_completed, 0) as pathways_projects_completed,
  
  -- Progress percentages (capped at 100%)
  CASE WHEN g.meetings_to_attend > 0 THEN LEAST(ROUND((COALESCE(p.meetings_attended, 0)::numeric / g.meetings_to_attend) * 100, 2), 100) ELSE 0 END as meetings_progress_percentage,
  CASE WHEN g.speeches_to_deliver > 0 THEN LEAST(ROUND((COALESCE(p.speeches_delivered, 0)::numeric / g.speeches_to_deliver) * 100, 2), 100) ELSE 0 END as speeches_progress_percentage,
  CASE WHEN g.evaluations_to_give > 0 THEN LEAST(ROUND((COALESCE(p.evaluations_given, 0)::numeric / g.evaluations_to_give) * 100, 2), 100) ELSE 0 END as evaluations_progress_percentage,
  CASE WHEN g.table_topics_participation > 0 THEN LEAST(ROUND((COALESCE(p.table_topics_participated, 0)::numeric / g.table_topics_participation) * 100, 2), 100) ELSE 0 END as table_topics_progress_percentage,
  CASE WHEN g.tag_team_roles > 0 THEN LEAST(ROUND((COALESCE(p.tag_team_roles_completed, 0)::numeric / g.tag_team_roles) * 100, 2), 100) ELSE 0 END as tag_team_progress_percentage,
  CASE WHEN g.tmod_roles > 0 THEN LEAST(ROUND((COALESCE(p.tmod_roles_completed, 0)::numeric / g.tmod_roles) * 100, 2), 100) ELSE 0 END as tmod_progress_percentage,
  CASE WHEN g.general_evaluator_roles > 0 THEN LEAST(ROUND((COALESCE(p.general_evaluator_roles_completed, 0)::numeric / g.general_evaluator_roles) * 100, 2), 100) ELSE 0 END as general_evaluator_progress_percentage,
  CASE WHEN g.table_topics_master_roles > 0 THEN LEAST(ROUND((COALESCE(p.table_topics_master_roles_completed, 0)::numeric / g.table_topics_master_roles) * 100, 2), 100) ELSE 0 END as table_topics_master_progress_percentage,
  CASE WHEN g.educational_sessions > 0 THEN LEAST(ROUND((COALESCE(p.educational_sessions_delivered, 0)::numeric / g.educational_sessions) * 100, 2), 100) ELSE 0 END as educational_sessions_progress_percentage,
  CASE WHEN g.other_leadership_roles > 0 THEN LEAST(ROUND((COALESCE(p.other_leadership_roles_completed, 0)::numeric / g.other_leadership_roles) * 100, 2), 100) ELSE 0 END as other_leadership_progress_percentage,
  CASE WHEN g.pathways_projects > 0 THEN LEAST(ROUND((COALESCE(p.pathways_projects_completed, 0)::numeric / g.pathways_projects) * 100, 2), 100) ELSE 0 END as pathways_progress_percentage,
  
  p.last_updated as progress_last_updated,
  
  -- User and club info
  up.full_name as user_name,
  up.email as user_email,
  c.name as club_name,
  c.club_number
  
FROM user_goals g
LEFT JOIN user_goal_progress p ON g.id = p.goal_id
LEFT JOIN app_user_profiles up ON g.user_id = up.id
LEFT JOIN clubs c ON g.club_id = c.id;