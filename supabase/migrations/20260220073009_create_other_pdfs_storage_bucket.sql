/*
  # Create storage bucket for other PDF resources

  1. New Storage Bucket
    - `other-pdfs` bucket for storing PDF files uploaded by club admins
    - Files organized by club_id

  2. Security
    - Enable RLS on storage.objects
    - Authenticated users can upload to their club folder
    - Authenticated users can view PDFs from their clubs
    - Club ExComm can delete PDFs from their club
*/

-- Create storage bucket for other PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('other-pdfs', 'other-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload PDFs to their club folder
CREATE POLICY "Club members can upload other PDFs to their club folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'other-pdfs' 
  AND (storage.foldername(name))[1] IN (
    SELECT club_id::text 
    FROM app_club_user_relationship 
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to view PDFs from their clubs
CREATE POLICY "Club members can view other PDFs from their clubs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'other-pdfs' 
  AND (storage.foldername(name))[1] IN (
    SELECT club_id::text 
    FROM app_club_user_relationship 
    WHERE user_id = auth.uid()
  )
);

-- Allow club ExComm to delete PDFs from their club
CREATE POLICY "Club ExComm can delete other PDFs from their club"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'other-pdfs' 
  AND (storage.foldername(name))[1] IN (
    SELECT club_id::text 
    FROM app_club_user_relationship 
    WHERE user_id = auth.uid() 
    AND role = 'excomm'
  )
);
