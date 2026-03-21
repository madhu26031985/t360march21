/*
  # Create app_user_invitation table for user invitations

  1. New Tables
    - `app_user_invitation`
      - `id` (uuid, primary key)
      - `invite_token` (text, unique) - Unique token for the invitation link
      - `club_id` (uuid) - Reference to the club
      - `invitee_email` (text) - Email of the invited user
      - `invitee_full_name` (text) - Full name of the invited user
      - `invitee_role` (text) - Role to be assigned (member, excomm, etc.)
      - `invited_by` (uuid) - Reference to the user who sent the invitation
      - `status` (text) - Status: pending, accepted, expired, rejected
      - `created_at` (timestamp)
      - `expires_at` (timestamp) - When the invitation expires
      - `accepted_at` (timestamp) - When the invitation was accepted
      - `accepted_user_id` (uuid) - ID of the user created when invitation was accepted

  2. Security
    - Enable RLS on `app_user_invitation` table
    - Add policies for authenticated users to manage invitations
    - Add indexes for performance

  3. Functions
    - Trigger to handle invitation acceptance and user creation
*/

-- Create the app_user_invitation table
CREATE TABLE IF NOT EXISTS app_user_invitation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_token text UNIQUE NOT NULL,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  invitee_full_name text NOT NULL,
  invitee_role text NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL REFERENCES app_user_profiles(id),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES app_user_profiles(id),
  
  -- Constraints
  CONSTRAINT chk_app_user_invitation_email_format 
    CHECK (invitee_email ~ '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT chk_app_user_invitation_name_not_empty 
    CHECK (invitee_full_name IS NOT NULL AND TRIM(invitee_full_name) <> ''),
  CONSTRAINT chk_app_user_invitation_role 
    CHECK (invitee_role IN ('member', 'excomm', 'visiting_tm', 'club_leader', 'guest')),
  CONSTRAINT chk_app_user_invitation_status 
    CHECK (status IN ('pending', 'accepted', 'expired', 'rejected'))
);

-- Enable RLS
ALTER TABLE app_user_invitation ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_user_invitation_club_id ON app_user_invitation(club_id);
CREATE INDEX IF NOT EXISTS idx_app_user_invitation_invitee_email ON app_user_invitation(invitee_email);
CREATE INDEX IF NOT EXISTS idx_app_user_invitation_invite_token ON app_user_invitation(invite_token);
CREATE INDEX IF NOT EXISTS idx_app_user_invitation_status ON app_user_invitation(status);
CREATE INDEX IF NOT EXISTS idx_app_user_invitation_expires_at ON app_user_invitation(expires_at);
CREATE INDEX IF NOT EXISTS idx_app_user_invitation_invited_by ON app_user_invitation(invited_by);

-- RLS Policies
CREATE POLICY "Authenticated users can manage invitations"
  ON app_user_invitation
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read invitations"
  ON app_user_invitation
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to handle invitation acceptance
CREATE OR REPLACE FUNCTION handle_invitation_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Set accepted_at timestamp
    NEW.accepted_at = now();
    
    -- The actual user creation and club relationship will be handled by the edge function
    -- This trigger just updates the timestamp
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invitation acceptance
CREATE TRIGGER trigger_handle_invitation_acceptance
  BEFORE UPDATE ON app_user_invitation
  FOR EACH ROW
  EXECUTE FUNCTION handle_invitation_acceptance();

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE app_user_invitation 
  SET status = 'expired'
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;