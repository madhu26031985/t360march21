/*
  # Modify Club Profile Triggers to Check Active Status

  1. Trigger Updates
    - Update `trigger_create_club_profile_for_new_club` to only fire when active = true
    - Update `trigger_sync_club_profile_on_club_insert` to only fire when active = true
    - Update other club profile sync triggers to check active status

  2. Function Updates
    - Modify trigger functions to check club active status
    - Prevent profile creation/updates for inactive clubs
    - Maintain data integrity

  3. Safety
    - Only affects new club creations
    - Existing active clubs remain unaffected
    - Preserves all existing functionality
*/

-- First, let's update the trigger function that creates club profiles
CREATE OR REPLACE FUNCTION create_club_profile_for_new_club()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Update the trigger function that syncs club profile on insert
CREATE OR REPLACE FUNCTION sync_club_profile_on_club_insert()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Update the trigger function that syncs club profile from clubs table updates
CREATE OR REPLACE FUNCTION sync_club_profile_from_clubs()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if the club is active (either was active or became active)
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
$$ LANGUAGE plpgsql;

-- Update the charter date sync function to check active status
CREATE OR REPLACE FUNCTION sync_charter_date_to_club_profile()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create a new trigger function specifically for when a club becomes active
CREATE OR REPLACE FUNCTION handle_club_activation()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Add trigger for club activation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_handle_club_activation'
  ) THEN
    CREATE TRIGGER trigger_handle_club_activation
      AFTER UPDATE OF active ON clubs
      FOR EACH ROW
      EXECUTE FUNCTION handle_club_activation();
  END IF;
END $$;