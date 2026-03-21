/*
  # Create App Meeting Roles Management Table

  1. New Tables
    - `app_meeting_roles_management`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `role_id` (uuid, foreign key to app_meeting_roles)
      - `role_name` (text, denormalized from app_meeting_roles)
      - `role_metric` (text, denormalized from app_meeting_roles)
      - `assigned_user_id` (uuid, foreign key to app_user_profiles, nullable)
      - `is_required` (boolean, default false)
      - `max_participants` (integer, default 1)
      - `order_index` (integer, default 0)
      - `status` (text, draft or published)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `app_meeting_roles_management` table
    - Add policies for authenticated users to manage roles

  3. Indexes
    - Index on meeting_id for efficient queries
    - Index on role_id for lookups
    - Index on status for filtering
    - Index on assigned_user_id for user queries

  4. Triggers
    - Auto-update updated_at timestamp
    - Denormalize role data from app_meeting_roles
*/

CREATE TABLE IF NOT EXISTS app_meeting_roles_management (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  role_id uuid NOT NULL,
  role_name text NOT NULL,
  role_metric text NOT NULL,
  assigned_user_id uuid,
  is_required boolean DEFAULT false,
  max_participants integer DEFAULT 1,
  order_index integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT fk_meeting_roles_management_meeting_id 
    FOREIGN KEY (meeting_id) REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  CONSTRAINT fk_meeting_roles_management_role_id 
    FOREIGN KEY (role_id) REFERENCES app_meeting_roles(id),
  CONSTRAINT fk_meeting_roles_management_assigned_user_id 
    FOREIGN KEY (assigned_user_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_meeting_roles_management_status 
    CHECK (status IN ('draft', 'published')),
  CONSTRAINT chk_meeting_roles_management_max_participants 
    CHECK (max_participants > 0),
  CONSTRAINT chk_meeting_roles_management_role_name_not_empty 
    CHECK (role_name IS NOT NULL AND TRIM(role_name) <> ''),
  CONSTRAINT chk_meeting_roles_management_role_metric_valid 
    CHECK (role_metric IN ('roles_completed', 'evaluations_given', 'speeches_delivered', 'table_topics_participated'))
);

-- Enable RLS
ALTER TABLE app_meeting_roles_management ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can manage meeting roles"
  ON app_meeting_roles_management
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read meeting roles"
  ON app_meeting_roles_management
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_management_meeting_id 
  ON app_meeting_roles_management(meeting_id);

CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_management_role_id 
  ON app_meeting_roles_management(role_id);

CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_management_status 
  ON app_meeting_roles_management(status);

CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_management_assigned_user_id 
  ON app_meeting_roles_management(assigned_user_id) 
  WHERE assigned_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_meeting_roles_management_order_index 
  ON app_meeting_roles_management(meeting_id, order_index);

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_app_meeting_roles_management_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_app_meeting_roles_management_updated_at
  BEFORE UPDATE ON app_meeting_roles_management
  FOR EACH ROW
  EXECUTE FUNCTION update_app_meeting_roles_management_updated_at();

-- Create trigger function to denormalize role data
CREATE OR REPLACE FUNCTION set_meeting_role_management_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Get role data from app_meeting_roles
  SELECT meeting_role_name, meeting_role_metric
  INTO NEW.role_name, NEW.role_metric
  FROM app_meeting_roles
  WHERE id = NEW.role_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for denormalizing role data
CREATE TRIGGER trigger_set_meeting_role_management_data
  BEFORE INSERT OR UPDATE OF role_id ON app_meeting_roles_management
  FOR EACH ROW
  EXECUTE FUNCTION set_meeting_role_management_data();