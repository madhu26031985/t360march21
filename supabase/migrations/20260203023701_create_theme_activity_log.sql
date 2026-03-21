/*
  # Create Theme Activity Log

  1. New Tables
    - `toastmaster_theme_activity_log`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `club_id` (uuid, foreign key to clubs)
      - `user_id` (uuid, foreign key to app_user_profiles)
      - `action` (text: 'created', 'updated', 'deleted')
      - `theme_before` (text, nullable)
      - `theme_after` (text, nullable)
      - `summary_before` (text, nullable)
      - `summary_after` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `toastmaster_theme_activity_log` table
    - Add policy for club members to view activity logs

  3. Triggers
    - Auto-log theme creation, updates, and deletions
*/

CREATE TABLE IF NOT EXISTS toastmaster_theme_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES app_club_meeting(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  theme_before text,
  theme_after text,
  summary_before text,
  summary_after text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE toastmaster_theme_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view theme activity for their club"
  ON toastmaster_theme_activity_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE app_club_user_relationship.club_id = toastmaster_theme_activity_log.club_id
      AND app_club_user_relationship.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_theme_activity_meeting ON toastmaster_theme_activity_log(meeting_id);
CREATE INDEX IF NOT EXISTS idx_theme_activity_club ON toastmaster_theme_activity_log(club_id);
CREATE INDEX IF NOT EXISTS idx_theme_activity_created_at ON toastmaster_theme_activity_log(created_at DESC);

-- Function to log theme creation
CREATE OR REPLACE FUNCTION log_theme_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO toastmaster_theme_activity_log (
    meeting_id,
    club_id,
    user_id,
    action,
    theme_after,
    summary_after
  ) VALUES (
    NEW.meeting_id,
    NEW.club_id,
    auth.uid(),
    'created',
    NEW.theme_of_the_day,
    NEW.theme_summary
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log theme updates
CREATE OR REPLACE FUNCTION log_theme_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.theme_of_the_day IS DISTINCT FROM NEW.theme_of_the_day) OR 
     (OLD.theme_summary IS DISTINCT FROM NEW.theme_summary) THEN
    INSERT INTO toastmaster_theme_activity_log (
      meeting_id,
      club_id,
      user_id,
      action,
      theme_before,
      theme_after,
      summary_before,
      summary_after
    ) VALUES (
      NEW.meeting_id,
      NEW.club_id,
      auth.uid(),
      'updated',
      OLD.theme_of_the_day,
      NEW.theme_of_the_day,
      OLD.theme_summary,
      NEW.theme_summary
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log theme deletion
CREATE OR REPLACE FUNCTION log_theme_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO toastmaster_theme_activity_log (
    meeting_id,
    club_id,
    user_id,
    action,
    theme_before,
    summary_before
  ) VALUES (
    OLD.meeting_id,
    OLD.club_id,
    auth.uid(),
    'deleted',
    OLD.theme_of_the_day,
    OLD.theme_summary
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_log_theme_creation ON toastmaster_meeting_data;
CREATE TRIGGER trigger_log_theme_creation
  AFTER INSERT ON toastmaster_meeting_data
  FOR EACH ROW
  WHEN (NEW.theme_of_the_day IS NOT NULL OR NEW.theme_summary IS NOT NULL)
  EXECUTE FUNCTION log_theme_creation();

DROP TRIGGER IF EXISTS trigger_log_theme_update ON toastmaster_meeting_data;
CREATE TRIGGER trigger_log_theme_update
  AFTER UPDATE ON toastmaster_meeting_data
  FOR EACH ROW
  EXECUTE FUNCTION log_theme_update();

DROP TRIGGER IF EXISTS trigger_log_theme_deletion ON toastmaster_meeting_data;
CREATE TRIGGER trigger_log_theme_deletion
  BEFORE DELETE ON toastmaster_meeting_data
  FOR EACH ROW
  WHEN (OLD.theme_of_the_day IS NOT NULL OR OLD.theme_summary IS NOT NULL)
  EXECUTE FUNCTION log_theme_deletion();