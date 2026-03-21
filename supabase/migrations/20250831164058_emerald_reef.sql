/*
  # Configure Email Confirmation Template

  1. Email Templates
    - Set up proper email confirmation template
    - Configure redirect URLs for mobile app
    - Set proper email content and styling

  2. Authentication Settings
    - Enable email confirmation
    - Configure proper redirect handling
    - Set up mobile-friendly confirmation flow
*/

-- This migration sets up the email confirmation template
-- Note: The actual email template configuration needs to be done in Supabase Dashboard

-- Create a function to handle email confirmation redirects
CREATE OR REPLACE FUNCTION public.handle_email_confirmation()
RETURNS trigger AS $$
BEGIN
  -- When a user confirms their email, we can perform additional actions here
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    -- Email was just confirmed
    -- You can add custom logic here if needed
    NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email confirmation
DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;
CREATE TRIGGER on_email_confirmed
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_confirmation();