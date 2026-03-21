/*
  # Create Club Join Requests System

  ## Overview
  This migration creates a comprehensive system for users to request to join clubs,
  with ExComm approval workflow and automatic expiry.

  ## 1. New Table: club_join_requests
  Stores all join requests with the following features:
  - User can have maximum 2 active requests at a time
  - Requests expire after 24 hours if not approved/rejected
  - Tracks phone number and reason for joining
  - Status tracking: pending, approved, rejected, withdrawn, expired

  ## 2. Columns
  - id: Primary key (uuid)
  - user_id: Foreign key to app_user_profiles (requester)
  - club_id: Foreign key to clubs (target club)
  - phone_number: Contact number (required)
  - reason: Why they want to join (required)
  - status: Request status (default: pending)
  - created_at: When request was made
  - expires_at: Auto-calculated (created_at + 24 hours)
  - reviewed_at: When ExComm reviewed
  - reviewed_by: Which ExComm member reviewed
  - updated_at: Last update timestamp

  ## 3. Security (RLS Policies)
  - Users can view their own requests
  - Users can create requests (max 2 active)
  - Users can withdraw their own pending requests
  - ExComm members can view all requests for their club
  - ExComm members can approve/reject requests

  ## 4. Constraints
  - Unique constraint on (user_id, club_id, status) where status = 'pending'
  - Check constraint to limit active requests per user
*/

-- Create enum for request status
DO $$ BEGIN
  CREATE TYPE club_join_request_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create club_join_requests table
CREATE TABLE IF NOT EXISTS club_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  reason text NOT NULL,
  status club_join_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES app_user_profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_club_join_requests_user_id ON club_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_club_join_requests_club_id ON club_join_requests(club_id);
CREATE INDEX IF NOT EXISTS idx_club_join_requests_status ON club_join_requests(status);
CREATE INDEX IF NOT EXISTS idx_club_join_requests_expires_at ON club_join_requests(expires_at);

-- Add unique constraint: user can't have multiple pending requests for same club
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_request 
  ON club_join_requests(user_id, club_id) 
  WHERE status = 'pending';

-- Create function to check max active requests (2)
CREATE OR REPLACE FUNCTION check_max_active_requests()
RETURNS TRIGGER AS $$
DECLARE
  active_count int;
BEGIN
  -- Count active requests for this user (pending status only)
  SELECT COUNT(*) INTO active_count
  FROM club_join_requests
  WHERE user_id = NEW.user_id
    AND status = 'pending'
    AND expires_at > now();
  
  -- If trying to create a new pending request and already have 2, reject
  IF NEW.status = 'pending' AND active_count >= 2 THEN
    RAISE EXCEPTION 'You can only have 2 active join requests at a time. Please withdraw an existing request first.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce max active requests
DROP TRIGGER IF EXISTS enforce_max_active_requests ON club_join_requests;
CREATE TRIGGER enforce_max_active_requests
  BEFORE INSERT ON club_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION check_max_active_requests();

-- Create function to auto-expire old requests
CREATE OR REPLACE FUNCTION expire_old_join_requests()
RETURNS void AS $$
BEGIN
  UPDATE club_join_requests
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_club_join_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_club_join_request_timestamp_trigger ON club_join_requests;
CREATE TRIGGER update_club_join_request_timestamp_trigger
  BEFORE UPDATE ON club_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_club_join_request_timestamp();

-- Enable RLS
ALTER TABLE club_join_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own requests
CREATE POLICY "users_can_view_own_requests"
  ON club_join_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policy: ExComm members can view all requests for their club
CREATE POLICY "excomm_can_view_club_requests"
  ON club_join_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.club_id = club_join_requests.club_id
        AND app_club_user_relationship.is_authenticated = true
        AND app_club_user_relationship.role IN ('president', 'vpe', 'vpm', 'vppr', 'secretary', 'treasurer', 'saa', 'ipp')
    )
  );

-- RLS Policy: Users can create requests (trigger enforces max 2)
CREATE POLICY "users_can_create_requests"
  ON club_join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    -- Ensure user is not already a member or has pending invite
    AND NOT EXISTS (
      SELECT 1
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.club_id = club_join_requests.club_id
    )
  );

-- RLS Policy: Users can withdraw their own pending requests
CREATE POLICY "users_can_withdraw_requests"
  ON club_join_requests
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('pending', 'withdrawn')
  );

-- RLS Policy: ExComm can approve/reject requests
CREATE POLICY "excomm_can_review_requests"
  ON club_join_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app_club_user_relationship
      WHERE app_club_user_relationship.user_id = auth.uid()
        AND app_club_user_relationship.club_id = club_join_requests.club_id
        AND app_club_user_relationship.is_authenticated = true
        AND app_club_user_relationship.role IN ('president', 'vpe', 'vpm', 'vppr', 'secretary', 'treasurer', 'saa', 'ipp')
    )
    AND status = 'pending'
  )
  WITH CHECK (
    status IN ('pending', 'approved', 'rejected')
  );

-- Create function to handle approved requests (add user as guest)
CREATE OR REPLACE FUNCTION handle_approved_join_request()
RETURNS TRIGGER AS $$
BEGIN
  -- If request was approved, add user to club as guest
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Insert into app_club_user_relationship as guest
    INSERT INTO app_club_user_relationship (
      user_id,
      club_id,
      role,
      is_authenticated
    )
    VALUES (
      NEW.user_id,
      NEW.club_id,
      'guest',
      true
    )
    ON CONFLICT (user_id, club_id) DO NOTHING;
    
    -- Set reviewed timestamp and reviewer
    NEW.reviewed_at = now();
    NEW.reviewed_by = auth.uid();
  END IF;
  
  -- If request was rejected, just set reviewed info
  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    NEW.reviewed_at = now();
    NEW.reviewed_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for handling approved requests
DROP TRIGGER IF EXISTS handle_approved_join_request_trigger ON club_join_requests;
CREATE TRIGGER handle_approved_join_request_trigger
  BEFORE UPDATE ON club_join_requests
  FOR EACH ROW
  WHEN (NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_approved_join_request();
