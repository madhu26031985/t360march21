/*
  # Add role grouping to club_profiles table

  1. New Columns
    - Add grouping columns for each role to categorize them as 'excomm' or 'club_leaders'
    
  2. Data Updates
    - Set appropriate groupings for existing roles
    - ExComm roles: president, vpe, vpm, vppr, secretary, treasurer, saa, ipp
    - Club Leaders: area_director, division_director, district_director, program_quality_director, club_growth_director, immediate_past_district_director
    
  3. Constraints
    - Add check constraints to ensure valid grouping values
*/

-- Add grouping columns for each role
DO $$
BEGIN
  -- President grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'president_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN president_grouping text DEFAULT 'excomm';
  END IF;

  -- IPP grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'ipp_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN ipp_grouping text DEFAULT 'excomm';
  END IF;

  -- VPE grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'vpe_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN vpe_grouping text DEFAULT 'excomm';
  END IF;

  -- VPM grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'vpm_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN vpm_grouping text DEFAULT 'excomm';
  END IF;

  -- VPPR grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'vppr_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN vppr_grouping text DEFAULT 'excomm';
  END IF;

  -- Secretary grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'secretary_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN secretary_grouping text DEFAULT 'excomm';
  END IF;

  -- Treasurer grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'treasurer_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN treasurer_grouping text DEFAULT 'excomm';
  END IF;

  -- SAA grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'saa_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN saa_grouping text DEFAULT 'excomm';
  END IF;

  -- Area Director grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'area_director_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN area_director_grouping text DEFAULT 'club_leaders';
  END IF;

  -- Division Director grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'division_director_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN division_director_grouping text DEFAULT 'club_leaders';
  END IF;

  -- District Director grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'district_director_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN district_director_grouping text DEFAULT 'club_leaders';
  END IF;

  -- Program Quality Director grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'program_quality_director_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN program_quality_director_grouping text DEFAULT 'club_leaders';
  END IF;

  -- Club Growth Director grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'club_growth_director_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN club_growth_director_grouping text DEFAULT 'club_leaders';
  END IF;

  -- Immediate Past District Director grouping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_profiles' AND column_name = 'immediate_past_district_director_grouping'
  ) THEN
    ALTER TABLE club_profiles ADD COLUMN immediate_past_district_director_grouping text DEFAULT 'club_leaders';
  END IF;
END $$;

-- Add check constraints for valid grouping values
DO $$
BEGIN
  -- Add constraint for president_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_president_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_president_grouping 
    CHECK (president_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for ipp_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_ipp_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_ipp_grouping 
    CHECK (ipp_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for vpe_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_vpe_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_vpe_grouping 
    CHECK (vpe_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for vpm_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_vpm_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_vpm_grouping 
    CHECK (vpm_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for vppr_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_vppr_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_vppr_grouping 
    CHECK (vppr_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for secretary_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_secretary_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_secretary_grouping 
    CHECK (secretary_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for treasurer_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_treasurer_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_treasurer_grouping 
    CHECK (treasurer_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for saa_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_saa_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_saa_grouping 
    CHECK (saa_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for area_director_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_area_director_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_area_director_grouping 
    CHECK (area_director_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for division_director_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_division_director_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_division_director_grouping 
    CHECK (division_director_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for district_director_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_district_director_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_district_director_grouping 
    CHECK (district_director_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for program_quality_director_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_program_quality_director_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_program_quality_director_grouping 
    CHECK (program_quality_director_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for club_growth_director_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_club_growth_director_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_club_growth_director_grouping 
    CHECK (club_growth_director_grouping IN ('excomm', 'club_leaders'));
  END IF;

  -- Add constraint for immediate_past_district_director_grouping if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_immediate_past_district_director_grouping' 
    AND table_name = 'club_profiles'
  ) THEN
    ALTER TABLE club_profiles ADD CONSTRAINT chk_immediate_past_district_director_grouping 
    CHECK (immediate_past_district_director_grouping IN ('excomm', 'club_leaders'));
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_club_profiles_president_grouping ON club_profiles (president_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_ipp_grouping ON club_profiles (ipp_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_vpe_grouping ON club_profiles (vpe_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_vpm_grouping ON club_profiles (vpm_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_vppr_grouping ON club_profiles (vppr_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_secretary_grouping ON club_profiles (secretary_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_treasurer_grouping ON club_profiles (treasurer_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_saa_grouping ON club_profiles (saa_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_area_director_grouping ON club_profiles (area_director_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_division_director_grouping ON club_profiles (division_director_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_district_director_grouping ON club_profiles (district_director_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_program_quality_director_grouping ON club_profiles (program_quality_director_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_club_growth_director_grouping ON club_profiles (club_growth_director_grouping);
CREATE INDEX IF NOT EXISTS idx_club_profiles_immediate_past_district_director_grouping ON club_profiles (immediate_past_district_director_grouping);