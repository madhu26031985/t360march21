/*
  # Add District Leadership Roles to Club Profiles

  1. New Columns
    - Add columns for Area Director (id, term_start, term_end)
    - Add columns for Division Director (id, term_start, term_end)
    - Add columns for District Director (id, term_start, term_end)
    - Add columns for Program Quality Director (id, term_start, term_end)
    - Add columns for Club Growth Director (id, term_start, term_end)
    - Add columns for Immediate Past District Director (id, term_start, term_end)

  2. Foreign Keys
    - All *_id columns reference app_user_profiles(id)
    - Set to NULL on delete to preserve historical records

  3. Indexes
    - Add indexes for efficient querying of leadership roles
*/

-- Add Area Director columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'area_director_id'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN area_director_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'area_director_term_start'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN area_director_term_start date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'area_director_term_end'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN area_director_term_end date;
  END IF;
END $$;

-- Add Division Director columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'division_director_id'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN division_director_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'division_director_term_start'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN division_director_term_start date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'division_director_term_end'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN division_director_term_end date;
  END IF;
END $$;

-- Add District Director columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'district_director_id'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN district_director_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'district_director_term_start'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN district_director_term_start date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'district_director_term_end'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN district_director_term_end date;
  END IF;
END $$;

-- Add Program Quality Director columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'program_quality_director_id'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN program_quality_director_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'program_quality_director_term_start'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN program_quality_director_term_start date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'program_quality_director_term_end'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN program_quality_director_term_end date;
  END IF;
END $$;

-- Add Club Growth Director columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'club_growth_director_id'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN club_growth_director_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'club_growth_director_term_start'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN club_growth_director_term_start date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'club_growth_director_term_end'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN club_growth_director_term_end date;
  END IF;
END $$;

-- Add Immediate Past District Director columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'immediate_past_district_director_id'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN immediate_past_district_director_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'immediate_past_district_director_term_start'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN immediate_past_district_director_term_start date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'immediate_past_district_director_term_end'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN immediate_past_district_director_term_end date;
  END IF;
END $$;

-- Add foreign key constraints for all new leadership roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'club_profiles_area_director_id_fkey'
  ) THEN
    ALTER TABLE club_profiles 
    ADD CONSTRAINT club_profiles_area_director_id_fkey 
    FOREIGN KEY (area_director_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'club_profiles_division_director_id_fkey'
  ) THEN
    ALTER TABLE club_profiles 
    ADD CONSTRAINT club_profiles_division_director_id_fkey 
    FOREIGN KEY (division_director_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'club_profiles_district_director_id_fkey'
  ) THEN
    ALTER TABLE club_profiles 
    ADD CONSTRAINT club_profiles_district_director_id_fkey 
    FOREIGN KEY (district_director_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'club_profiles_program_quality_director_id_fkey'
  ) THEN
    ALTER TABLE club_profiles 
    ADD CONSTRAINT club_profiles_program_quality_director_id_fkey 
    FOREIGN KEY (program_quality_director_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'club_profiles_club_growth_director_id_fkey'
  ) THEN
    ALTER TABLE club_profiles 
    ADD CONSTRAINT club_profiles_club_growth_director_id_fkey 
    FOREIGN KEY (club_growth_director_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'club_profiles_immediate_past_district_director_id_fkey'
  ) THEN
    ALTER TABLE club_profiles 
    ADD CONSTRAINT club_profiles_immediate_past_district_director_id_fkey 
    FOREIGN KEY (immediate_past_district_director_id) REFERENCES app_user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_club_profiles_area_director_id 
ON club_profiles(area_director_id) WHERE area_director_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_profiles_division_director_id 
ON club_profiles(division_director_id) WHERE division_director_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_profiles_district_director_id 
ON club_profiles(district_director_id) WHERE district_director_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_profiles_program_quality_director_id 
ON club_profiles(program_quality_director_id) WHERE program_quality_director_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_profiles_club_growth_director_id 
ON club_profiles(club_growth_director_id) WHERE club_growth_director_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_profiles_immediate_past_district_director_id 
ON club_profiles(immediate_past_district_director_id) WHERE immediate_past_district_director_id IS NOT NULL;