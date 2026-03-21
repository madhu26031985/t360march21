/*
  # Create app_meeting_roles table

  1. New Tables
    - `app_meeting_roles`
      - `id` (uuid, primary key)
      - `meeting_role_name` (text, unique, not null)
      - `meeting_role_metric` (text, not null)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `app_meeting_roles` table
    - Add policy for authenticated users to read meeting roles

  3. Data Population
    - Insert all predefined meeting roles with their corresponding metrics
    - Roles include speakers, evaluators, table topics participants, and administrative roles
*/

CREATE TABLE IF NOT EXISTS app_meeting_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_role_name text UNIQUE NOT NULL,
  meeting_role_metric text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_meeting_roles ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read meeting roles
CREATE POLICY "Authenticated users can read meeting roles"
  ON app_meeting_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_metric 
  ON app_meeting_roles (meeting_role_metric);

CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_name 
  ON app_meeting_roles (meeting_role_name);

-- Add constraint to ensure valid metric types
ALTER TABLE app_meeting_roles 
ADD CONSTRAINT chk_app_meeting_roles_valid_metric 
CHECK (meeting_role_metric IN ('roles_completed', 'evaluations_given', 'speeches_delivered', 'table_topics_participated'));

-- Add constraint to ensure role name is not empty
ALTER TABLE app_meeting_roles 
ADD CONSTRAINT chk_app_meeting_roles_name_not_empty 
CHECK (meeting_role_name IS NOT NULL AND TRIM(meeting_role_name) <> '');

-- Insert all meeting roles with their corresponding metrics
INSERT INTO app_meeting_roles (meeting_role_name, meeting_role_metric) VALUES
-- Administrative and Support Roles (roles_completed)
('Ah Counter', 'roles_completed'),
('Grammarian', 'roles_completed'),
('Guest Introducer', 'roles_completed'),
('Listener', 'roles_completed'),
('Quiz Master', 'roles_completed'),
('Timer', 'roles_completed'),
('Table Topics Master', 'roles_completed'),
('Toastmaster of the Day', 'roles_completed'),
('Educational Speaker', 'roles_completed'),
('Sergeant at Arms', 'roles_completed'),
('Presiding Officer', 'roles_completed'),

-- Evaluator Roles (evaluations_given)
('Evaluator 1', 'evaluations_given'),
('Evaluator 2', 'evaluations_given'),
('Evaluator 3', 'evaluations_given'),
('Evaluator 4', 'evaluations_given'),
('Evaluator 5', 'evaluations_given'),
('Evaluator 6', 'evaluations_given'),
('Evaluator 7', 'evaluations_given'),
('Evaluator 8', 'evaluations_given'),
('Evaluator 9', 'evaluations_given'),
('Evaluator 10', 'evaluations_given'),
('Evaluator 11', 'evaluations_given'),
('Evaluator 12', 'evaluations_given'),

-- Speaker Roles (speeches_delivered)
('Speaker 1', 'speeches_delivered'),
('Speaker 2', 'speeches_delivered'),
('Speaker 3', 'speeches_delivered'),
('Speaker 4', 'speeches_delivered'),
('Speaker 5', 'speeches_delivered'),
('Speaker 6', 'speeches_delivered'),
('Speaker 7', 'speeches_delivered'),
('Speaker 8', 'speeches_delivered'),
('Speaker 9', 'speeches_delivered'),
('Speaker 10', 'speeches_delivered'),
('Speaker 11', 'speeches_delivered'),
('Speaker 12', 'speeches_delivered'),

-- Table Topics Participants (table_topics_participated)
('Table Topics Speaker 1', 'table_topics_participated'),
('Table Topics Speaker 2', 'table_topics_participated'),
('Table Topics Speaker 3', 'table_topics_participated'),
('Table Topics Speaker 4', 'table_topics_participated'),
('Table Topics Speaker 5', 'table_topics_participated'),
('Table Topics Speaker 6', 'table_topics_participated'),
('Table Topics Speaker 7', 'table_topics_participated'),
('Table Topics Speaker 8', 'table_topics_participated'),
('Table Topics Speaker 9', 'table_topics_participated'),
('Table Topics Speaker 10', 'table_topics_participated'),
('Table Topics Speaker 11', 'table_topics_participated'),
('Table Topics Speaker 12', 'table_topics_participated'),

-- Table Topic Evaluators (evaluations_given)
('Table Topic Evaluator 1', 'evaluations_given'),
('Table Topic Evaluator 2', 'evaluations_given'),
('Table Topic Evaluator 3', 'evaluations_given'),
('Table Topic Evaluator 4', 'evaluations_given'),
('Table Topic Evaluator 5', 'evaluations_given'),
('Table Topic Evaluator 6', 'evaluations_given'),
('Table Topic Evaluator 7', 'evaluations_given'),
('Table Topic Evaluator 8', 'evaluations_given'),
('Table Topic Evaluator 9', 'evaluations_given'),
('Table Topic Evaluator 10', 'evaluations_given'),
('Table Topic Evaluator 11', 'evaluations_given'),
('Table Topic Evaluator 12', 'evaluations_given'),

-- Master Evaluators (evaluations_given)
('Master Evaluator 1', 'evaluations_given'),
('Master Evaluator 2', 'evaluations_given'),
('Master Evaluator 3', 'evaluations_given'),
('Master Evaluator 4', 'evaluations_given'),
('Master Evaluator 5', 'evaluations_given'),
('Master Evaluator 6', 'evaluations_given'),
('Master Evaluator 7', 'evaluations_given'),
('Master Evaluator 8', 'evaluations_given'),
('Master Evaluator 9', 'evaluations_given'),
('Master Evaluator 10', 'evaluations_given'),
('Master Evaluator 11', 'evaluations_given'),
('Master Evaluator 12', 'evaluations_given'),

-- Chief Judges (evaluations_given)
('Chief Judge 1', 'evaluations_given'),
('Chief Judge 2', 'evaluations_given'),
('Chief Judge 3', 'evaluations_given'),
('Chief Judge 4', 'evaluations_given'),
('Chief Judge 5', 'evaluations_given'),
('Chief Judge 6', 'evaluations_given'),
('Chief Judge 7', 'evaluations_given'),
('Chief Judge 8', 'evaluations_given'),
('Chief Judge 9', 'evaluations_given'),
('Chief Judge 10', 'evaluations_given'),
('Chief Judge 11', 'evaluations_given'),
('Chief Judge 12', 'evaluations_given');

-- Create trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_meeting_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_app_meeting_roles_updated_at
  BEFORE UPDATE ON app_meeting_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_app_meeting_roles_updated_at();