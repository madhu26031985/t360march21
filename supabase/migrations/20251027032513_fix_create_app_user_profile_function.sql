/*
  # Fix create_app_user_profile Function
  
  This migration fixes the user signup issue by updating the create_app_user_profile() 
  function to remove the phone_number field that was previously removed from the 
  app_user_profiles table.
  
  ## Problem
  - The create_app_user_profile() trigger function was still trying to insert phone_number
  - The phone_number column was removed from app_user_profiles table
  - This caused "Database error saving new user" when users tried to sign up
  
  ## Changes
  - Update create_app_user_profile() function to remove phone_number field
  - Function now only inserts id, email, and full_name
  
  ## Impact
  - Fixes signup functionality
  - New users can now successfully create accounts
*/

-- Drop and recreate the function without phone_number
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$function$;
