/*
  # Create App Minutes Management Table

  1. New Tables
    - `app_minutes_management`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to app_club_meeting)
      - `title` (text, required)
      - `document_type` (text, enum: google_doc, pdf_url, pdf_file, website_url)
      - `document_url` (text, nullable)
      - `pdf_data` (text, nullable for base64 encoded PDF)
      - `status` (text, enum: pending, available)
      - `created_by` (uuid, foreign key to app_user_profiles)
      - `club_id` (uuid, foreign key to clubs)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `app_minutes_management` table
    - Add policies for authenticated users to manage minutes within their clubs
    - Add policies for ExComm members to have full access

  3. Constraints
    - One meeting can have only one minutes document (unique constraint on meeting_id)
    - Status automatically set based on document availability
    - Document validation constraints
    - Title and document type are required
*/

CREATE TABLE IF NOT EXISTS app_minutes_management (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  title text NOT NULL,
  document_type text NOT NULL,
  document_url text,
  pdf_data text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL,
  club_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints
ALTER TABLE app_minutes_management 
ADD CONSTRAINT chk_app_minutes_management_title_not_empty 
CHECK (title IS NOT NULL AND TRIM(title) <> '');

ALTER TABLE app_minutes_management 
ADD CONSTRAINT chk_app_minutes_management_document_type 
CHECK (document_type IN ('google_doc', 'pdf_url', 'pdf_file', 'website_url'));

ALTER TABLE app_minutes_management 
ADD CONSTRAINT chk_app_minutes_management_status 
CHECK (status IN ('pending', 'available'));

ALTER TABLE app_minutes_management 
ADD CONSTRAINT chk_app_minutes_management_document_data 
CHECK (
  (document_type = 'google_doc' AND document_url IS NOT NULL AND pdf_data IS NULL) OR
  (document_type = 'pdf_url' AND document_url IS NOT NULL AND pdf_data IS NULL) OR
  (document_type = 'website_url' AND document_url IS NOT NULL AND pdf_data IS NULL) OR
  (document_type = 'pdf_file' AND document_url IS NULL AND pdf_data IS NOT NULL)
);

-- Unique constraint: one minutes document per meeting
ALTER TABLE app_minutes_management 
ADD CONSTRAINT unique_minutes_per_meeting 
UNIQUE (meeting_id);

-- Add foreign key constraints
ALTER TABLE app_minutes_management 
ADD CONSTRAINT fk_app_minutes_management_meeting_id 
FOREIGN KEY (meeting_id) REFERENCES app_club_meeting(id) ON DELETE CASCADE;

ALTER TABLE app_minutes_management 
ADD CONSTRAINT fk_app_minutes_management_created_by 
FOREIGN KEY (created_by) REFERENCES app_user_profiles(id) ON DELETE CASCADE;

ALTER TABLE app_minutes_management 
ADD CONSTRAINT fk_app_minutes_management_club_id 
FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_minutes_management_meeting_id 
ON app_minutes_management(meeting_id);

CREATE INDEX IF NOT EXISTS idx_app_minutes_management_club_id 
ON app_minutes_management(club_id);

CREATE INDEX IF NOT EXISTS idx_app_minutes_management_status 
ON app_minutes_management(status);

CREATE INDEX IF NOT EXISTS idx_app_minutes_management_created_by 
ON app_minutes_management(created_by);

CREATE INDEX IF NOT EXISTS idx_app_minutes_management_created_at 
ON app_minutes_management(created_at DESC);

-- Enable Row Level Security
ALTER TABLE app_minutes_management ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Club members can read minutes from their clubs"
  ON app_minutes_management
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "ExComm members can manage minutes in their clubs"
  ON app_minutes_management
  FOR ALL
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
        AND role = 'excomm' 
        AND is_authenticated = true
    )
  )
  WITH CHECK (
    club_id IN (
      SELECT club_id 
      FROM app_club_user_relationship 
      WHERE user_id = auth.uid() 
        AND role = 'excomm' 
        AND is_authenticated = true
    )
  );

-- Function to automatically update status based on document availability
CREATE OR REPLACE FUNCTION update_minutes_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Set status to 'available' if document is provided, otherwise 'pending'
  IF (NEW.document_url IS NOT NULL AND TRIM(NEW.document_url) <> '') OR 
     (NEW.pdf_data IS NOT NULL AND TRIM(NEW.pdf_data) <> '') THEN
    NEW.status = 'available';
  ELSE
    NEW.status = 'pending';
  END IF;
  
  -- Update the updated_at timestamp
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update status and timestamp
CREATE TRIGGER trigger_update_minutes_status
  BEFORE INSERT OR UPDATE ON app_minutes_management
  FOR EACH ROW
  EXECUTE FUNCTION update_minutes_status();