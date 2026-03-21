/*
  # Create Avatars Storage Bucket

  1. New Storage Bucket
    - `avatars` bucket for storing user profile pictures
    - Public access enabled for reading avatar images
    - File size limit: 5MB per file
    - Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
  
  2. Security Policies
    - Authenticated users can upload their own avatars
    - Anyone can view avatars (public read access)
    - Users can only update/delete their own avatars
    - File path pattern: {user_id}/{filename}
  
  3. Important Notes
    - This enables direct file uploads from mobile apps
    - Eliminates base64 conversion crashes on iOS
    - Provides better performance and scalability
    - Automatic public URL generation for avatar access
*/

-- Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Anyone can view avatars (public read)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Policy: Users can update their own avatars
CREATE POLICY "Users can update their own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own avatars
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );