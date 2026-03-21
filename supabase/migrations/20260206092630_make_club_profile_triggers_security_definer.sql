/*
  # Make Club Profile Trigger Functions SECURITY DEFINER

  ## Problem
  When a club is created, triggers automatically create a club_profiles entry.
  These triggers run as the current user and hit RLS policies on club_profiles.
  Some policies query app_club_user_relationship, which can cause recursion
  or fail because the user hasn't been added to the club yet.

  ## Solution
  Make all club profile trigger functions SECURITY DEFINER so they bypass RLS.
  These are system-generated operations that should always succeed.

  ## Security
  - Functions only perform automated sync operations
  - No user input is processed
  - Data is copied from the clubs table (already validated)
  - Safe to bypass RLS for these automated operations
*/

-- Make create_club_profile_for_new_club SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_club_profile_for_new_club()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create club profile if the club is active
  IF NEW.active = true THEN
    INSERT INTO club_profiles (
      club_id,
      club_name,
      club_number,
      charter_date,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.name,
      NEW.club_number,
      NEW.charter_date,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Make sync_club_profile_on_club_insert SECURITY DEFINER
CREATE OR REPLACE FUNCTION sync_club_profile_on_club_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sync if the club is active
  IF NEW.active = true THEN
    -- Check if club profile exists
    IF NOT EXISTS (
      SELECT 1 FROM club_profiles WHERE club_id = NEW.id
    ) THEN
      -- Create club profile
      INSERT INTO club_profiles (
        club_id,
        club_name,
        club_number,
        charter_date,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.name,
        NEW.club_number,
        NEW.charter_date,
        NOW(),
        NOW()
      );
    ELSE
      -- Update existing club profile
      UPDATE club_profiles SET
        club_name = NEW.name,
        club_number = NEW.club_number,
        charter_date = NEW.charter_date,
        updated_at = NOW()
      WHERE club_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Make sync_club_profile_from_clubs SECURITY DEFINER
CREATE OR REPLACE FUNCTION sync_club_profile_from_clubs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sync if the club is active
  IF NEW.active = true THEN
    -- Check if club profile exists
    IF NOT EXISTS (
      SELECT 1 FROM club_profiles WHERE club_id = NEW.id
    ) THEN
      -- Create club profile if it doesn't exist and club is now active
      INSERT INTO club_profiles (
        club_id,
        club_name,
        club_number,
        charter_date,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.name,
        NEW.club_number,
        NEW.charter_date,
        NOW(),
        NOW()
      );
    ELSE
      -- Update existing club profile
      UPDATE club_profiles SET
        club_name = NEW.name,
        club_number = NEW.club_number,
        charter_date = NEW.charter_date,
        updated_at = NOW()
      WHERE club_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Make sync_charter_date_to_club_profile SECURITY DEFINER
CREATE OR REPLACE FUNCTION sync_charter_date_to_club_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sync if the club is active
  IF NEW.active = true THEN
    UPDATE club_profiles 
    SET 
      charter_date = NEW.charter_date,
      updated_at = NOW()
    WHERE club_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Make handle_club_activation SECURITY DEFINER
CREATE OR REPLACE FUNCTION handle_club_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If club was just activated (changed from false to true)
  IF OLD.active = false AND NEW.active = true THEN
    -- Create club profile if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM club_profiles WHERE club_id = NEW.id
    ) THEN
      INSERT INTO club_profiles (
        club_id,
        club_name,
        club_number,
        charter_date,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.name,
        NEW.club_number,
        NEW.charter_date,
        NOW(),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
