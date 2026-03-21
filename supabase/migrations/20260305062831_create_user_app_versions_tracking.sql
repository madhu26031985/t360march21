/*
  # Create User App Versions Tracking

  ## Summary
  Tracks which app version each user is running, updated automatically on every login.

  ## New Tables

  ### `user_app_versions`
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK to auth.users) — the user
  - `app_version` (text) — e.g. "69.0.0"
  - `platform` (text) — 'ios', 'android', or 'web'
  - `build_number` (text, nullable) — native build number if available
  - `last_seen_at` (timestamptz) — last time this user was seen on this version/platform
  - `first_seen_at` (timestamptz) — when this version was first recorded
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only upsert their own version record
  - Authenticated users can read all version records (for admin reporting)
    but only excomm/admin use the report screen — reading is safe since
    no sensitive data is exposed beyond version + platform

  ## Notes
  - Unique constraint on (user_id, platform) — one record per user per platform
  - On login the client upserts with the current version, updating last_seen_at
*/

CREATE TABLE IF NOT EXISTS user_app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_version text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'unknown' CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  build_number text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_user_app_versions_user_id ON user_app_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_versions_platform ON user_app_versions(platform);
CREATE INDEX IF NOT EXISTS idx_user_app_versions_app_version ON user_app_versions(app_version);
CREATE INDEX IF NOT EXISTS idx_user_app_versions_last_seen ON user_app_versions(last_seen_at DESC);

ALTER TABLE user_app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can upsert their own version record"
  ON user_app_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own version record"
  ON user_app_versions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view all version records"
  ON user_app_versions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION update_user_app_versions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_app_versions_updated_at
  BEFORE UPDATE ON user_app_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_app_versions_updated_at();
