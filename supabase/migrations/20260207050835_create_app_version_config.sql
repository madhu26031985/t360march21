/*
  # App Version Configuration System

  1. New Tables
    - `app_version_config`
      - `id` (uuid, primary key)
      - `platform` (text) - 'ios' or 'android'
      - `current_version` (text) - latest version available (e.g., '1.0.0')
      - `minimum_version` (text) - minimum required version
      - `force_update` (boolean) - whether update is mandatory
      - `update_message` (text) - custom message to show users
      - `store_url` (text) - link to app store listing
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `app_version_config` table
    - Add policy for all authenticated users to read version info
    - Only admins can update version config
*/

-- Create app_version_config table
CREATE TABLE IF NOT EXISTS app_version_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  current_version text NOT NULL,
  minimum_version text NOT NULL,
  force_update boolean DEFAULT false,
  update_message text,
  store_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(platform)
);

-- Enable RLS
ALTER TABLE app_version_config ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read version config
CREATE POLICY "Anyone can read version config"
  ON app_version_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only for system management (will be managed via Supabase dashboard or admin function)
CREATE POLICY "System can manage version config"
  ON app_version_config
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Insert initial version data
INSERT INTO app_version_config (platform, current_version, minimum_version, force_update, update_message, store_url)
VALUES 
  ('ios', '1.0.0', '1.0.0', false, 'A new version is available! Update now for the best experience.', 'https://apps.apple.com/app/your-app-id'),
  ('android', '1.0.0', '1.0.0', false, 'A new version is available! Update now for the best experience.', 'https://play.google.com/store/apps/details?id=your.package.name')
ON CONFLICT (platform) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_app_version_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER app_version_config_updated_at
  BEFORE UPDATE ON app_version_config
  FOR EACH ROW
  EXECUTE FUNCTION update_app_version_config_updated_at();