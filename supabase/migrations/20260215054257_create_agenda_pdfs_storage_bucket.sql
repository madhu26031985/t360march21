/*
  # Create Agenda PDFs Storage Bucket

  1. Storage Setup
    - Creates public storage bucket for agenda PDFs
    - File size limit: 50MB per PDF
    - Allowed MIME types: PDF only
    - Files organized by: club_id/meeting_id/filename.pdf

  2. Security Policies
    - Club members can upload agendas for their clubs
    - Anyone with the link can view (public bucket)
    - Only ExComm members can delete agendas

  3. Notes
    - Public URLs are shareable without authentication
    - Files are organized by club and meeting for easy management
*/

-- Create the agendas storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agendas',
  'agendas',
  true, -- Public bucket for shareable links
  52428800, -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow club members to upload agendas for their clubs
CREATE POLICY "Club members can upload agenda PDFs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agendas'
    AND (storage.foldername(name))[1] IN (
      SELECT club_id::text
      FROM app_club_user_relationship
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Anyone can view agenda PDFs (public bucket)
CREATE POLICY "Anyone can view agenda PDFs"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'agendas');

-- Policy: Only ExComm members can update agendas
CREATE POLICY "ExComm can update agenda PDFs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agendas'
    AND (storage.foldername(name))[1] IN (
      SELECT club_id::text
      FROM app_club_user_relationship
      WHERE user_id = auth.uid()
      AND role = 'excomm'
    )
  );

-- Policy: Only ExComm members can delete agendas
CREATE POLICY "ExComm can delete agenda PDFs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agendas'
    AND (storage.foldername(name))[1] IN (
      SELECT club_id::text
      FROM app_club_user_relationship
      WHERE user_id = auth.uid()
      AND role = 'excomm'
    )
  );

-- Create table to track shared agendas (useful for analytics and management)
CREATE TABLE IF NOT EXISTS shared_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  access_count integer DEFAULT 0,
  UNIQUE(meeting_id)
);

-- Enable RLS
ALTER TABLE shared_agendas ENABLE ROW LEVEL SECURITY;

-- Policy: Club members can view shared agendas for their clubs
CREATE POLICY "Club members can view shared agendas"
  ON shared_agendas
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id
      FROM app_club_user_relationship
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Club members can insert shared agendas for their clubs
CREATE POLICY "Club members can create shared agendas"
  ON shared_agendas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id IN (
      SELECT club_id
      FROM app_club_user_relationship
      WHERE user_id = auth.uid()
    )
  );

-- Policy: ExComm can delete shared agendas
CREATE POLICY "ExComm can delete shared agendas"
  ON shared_agendas
  FOR DELETE
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id
      FROM app_club_user_relationship
      WHERE user_id = auth.uid()
      AND role = 'excomm'
    )
  );

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_shared_agendas_meeting ON shared_agendas(meeting_id);
CREATE INDEX IF NOT EXISTS idx_shared_agendas_club ON shared_agendas(club_id);
