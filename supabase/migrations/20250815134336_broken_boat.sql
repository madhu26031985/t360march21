/*
  # Create Club Chat System

  1. New Tables
    - `club_chat_messages`
      - `id` (uuid, primary key)
      - `club_id` (uuid, foreign key to clubs)
      - `sender_id` (uuid, foreign key to app_user_profiles)
      - `sender_name` (text, denormalized for performance)
      - `sender_avatar` (text, denormalized for performance)
      - `sender_role` (text, denormalized for performance)
      - `message` (text, the chat message content)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `club_chat_messages` table
    - Add policies for authenticated users to read/write messages in their clubs
    - Add trigger to populate sender details automatically

  3. Indexes
    - Add indexes for efficient querying by club_id and created_at
*/

-- Create club_chat_messages table
CREATE TABLE IF NOT EXISTS club_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES app_user_profiles(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  sender_avatar text,
  sender_role text NOT NULL DEFAULT 'member',
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE club_chat_messages ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_club_chat_messages_club_id ON club_chat_messages(club_id);
CREATE INDEX IF NOT EXISTS idx_club_chat_messages_created_at ON club_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_chat_messages_sender_id ON club_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_club_chat_messages_club_created ON club_chat_messages(club_id, created_at DESC);

-- Add constraints
ALTER TABLE club_chat_messages 
ADD CONSTRAINT chk_club_chat_messages_message_not_empty 
CHECK (message IS NOT NULL AND TRIM(message) <> '');

ALTER TABLE club_chat_messages 
ADD CONSTRAINT chk_club_chat_messages_sender_name_not_empty 
CHECK (sender_name IS NOT NULL AND TRIM(sender_name) <> '');

-- RLS Policies
CREATE POLICY "Users can read messages in their clubs"
  ON club_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
        AND club_id = club_chat_messages.club_id 
        AND is_authenticated = true
    )
  );

CREATE POLICY "Users can send messages to their clubs"
  ON club_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
        AND club_id = club_chat_messages.club_id 
        AND is_authenticated = true
    )
  );

CREATE POLICY "Users can update their own messages"
  ON club_chat_messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON club_chat_messages
  FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- Function to auto-populate sender details
CREATE OR REPLACE FUNCTION populate_chat_sender_details()
RETURNS TRIGGER AS $$
BEGIN
  -- Get sender details from app_user_profiles and club relationship
  SELECT 
    aup.full_name,
    aup.avatar_url,
    acur.role
  INTO 
    NEW.sender_name,
    NEW.sender_avatar,
    NEW.sender_role
  FROM app_user_profiles aup
  JOIN app_club_user_relationship acur ON acur.user_id = aup.id
  WHERE aup.id = NEW.sender_id 
    AND acur.club_id = NEW.club_id 
    AND acur.is_authenticated = true;

  -- Set updated_at
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-populate sender details
CREATE TRIGGER trigger_populate_chat_sender_details
  BEFORE INSERT ON club_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION populate_chat_sender_details();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_club_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on message updates
CREATE TRIGGER trigger_update_club_chat_messages_updated_at
  BEFORE UPDATE ON club_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_club_chat_messages_updated_at();