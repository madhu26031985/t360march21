/*
  # Sync user_profiles and app_user_profiles tables

  1. Problem
    - Users exist in app_user_profiles but not in user_profiles
    - This causes foreign key constraint violations when creating resources
    - The resources table has a foreign key to user_profiles(id)

  2. Solution
    - Create a trigger to automatically sync new users to user_profiles
    - Create a function to sync existing users on insert/update

  3. Changes
    - Add trigger function to sync app_user_profiles to user_profiles
    - Add trigger on app_user_profiles table
*/

-- Create function to sync user profiles
CREATE OR REPLACE FUNCTION sync_user_profiles()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user_profiles when app_user_profiles changes
  INSERT INTO user_profiles (
    id, 
    email, 
    full_name, 
    is_active, 
    role, 
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.full_name,
    COALESCE(NEW.is_active, true),
    CASE 
      WHEN NEW.role = 'new_user' THEN 'member'
      ELSE NEW.role 
    END,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    is_active = EXCLUDED.is_active,
    role = EXCLUDED.role,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync on insert or update
DROP TRIGGER IF EXISTS sync_user_profiles_trigger ON app_user_profiles;
CREATE TRIGGER sync_user_profiles_trigger
  AFTER INSERT OR UPDATE ON app_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_profiles();
