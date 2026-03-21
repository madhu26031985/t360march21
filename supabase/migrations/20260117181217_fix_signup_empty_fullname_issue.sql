/*
  # Fix Signup Error - Empty Full Name Issue
  
  ## Summary
  Fixes the "Database error saving new user" issue that occurs when users sign up.
  
  ## Problem
  The create_app_user_profile() function uses COALESCE to default to empty string ('') 
  when full_name is missing from metadata. However, the app_user_profiles table has a 
  constraint that requires full_name to be non-empty after trimming:
  
  CHECK (((full_name IS NOT NULL) AND (TRIM(BOTH FROM full_name) <> ''::text)))
  
  This causes signup to fail because the trigger tries to insert an empty string.
  
  ## Changes
  - Update create_app_user_profile() function to default to 'User' instead of empty string
  - This ensures the constraint is always satisfied while maintaining data integrity
  
  ## Security
  - No RLS changes needed
  - Function remains SECURITY DEFINER as required for auth triggers
*/

-- Update the function to use a proper default value
CREATE OR REPLACE FUNCTION public.create_app_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.app_user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'User')
  );
  RETURN NEW;
END;
$function$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.create_app_user_profile() IS 
  'Trigger function to create user profile on auth.users INSERT. Uses NULLIF and TRIM to ensure full_name is never empty, defaulting to "User" if not provided.';
