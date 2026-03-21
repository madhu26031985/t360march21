/*
  # Create Evaluation Forms Storage Bucket

  1. Storage
    - Create `evaluation-forms` bucket for storing evaluation PDFs
    - Enable public access for viewing
    - Set file size limit to 10MB

  2. Security
    - Authenticated users can upload evaluation forms for their club meetings
    - Anyone with the link can view the PDFs (public bucket)
*/

-- Create the evaluation-forms bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evaluation-forms',
  'evaluation-forms',
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload evaluation forms
CREATE POLICY "Authenticated users can upload evaluation forms"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'evaluation-forms');

-- Allow authenticated users to update their own uploads
CREATE POLICY "Users can update their evaluation forms"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'evaluation-forms');

-- Allow authenticated users to delete their evaluation forms
CREATE POLICY "Users can delete their evaluation forms"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'evaluation-forms');

-- Allow public read access (anyone with the link can view)
CREATE POLICY "Public can view evaluation forms"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'evaluation-forms');