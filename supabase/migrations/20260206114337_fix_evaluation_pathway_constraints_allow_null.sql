/*
  # Fix Evaluation Pathway Constraints to Allow NULL Values  ## Summary
  Fixes incorrect CHECK constraints on app_evaluation_pathway table that were preventing
  null values for pathway_name and project_name. These fields should be optional (nullable)
  but the original constraints required them to always be NOT NULL.  ## Changes  - Update `chk_app_evaluation_pathway_pathway_name_not_empty` constraint
    - Old: Requires pathway_name to ALWAYS be NOT NULL and not empty
    - New: Allows NULL, but if provided, it must not be empty
  
  - Update `chk_app_evaluation_pathway_project_name_not_empty` constraint
    - Old: Requires project_name to ALWAYS be NOT NULL and not empty
    - New: Allows NULL, but if provided, it must not be empty

  ## Impact
  - Allows saving speech details without pathway_name or project_name
  - Particularly fixes Ice Breaker speeches which often don't have pathway info
  - Still validates that if these fields are provided, they're not empty strings

  ## Security
  - No changes to RLS policies
  - Constraints still prevent empty string submissions
*/

-- Drop the existing pathway_name constraint
ALTER TABLE app_evaluation_pathway 
DROP CONSTRAINT IF EXISTS chk_app_evaluation_pathway_pathway_name_not_empty;

-- Add corrected constraint: allows NULL, but if not NULL, must not be empty
ALTER TABLE app_evaluation_pathway 
ADD CONSTRAINT chk_app_evaluation_pathway_pathway_name_not_empty 
CHECK (pathway_name IS NULL OR TRIM(pathway_name) <> '');

-- Drop the existing project_name constraint
ALTER TABLE app_evaluation_pathway 
DROP CONSTRAINT IF EXISTS chk_app_evaluation_pathway_project_name_not_empty;

-- Add corrected constraint: allows NULL, but if not NULL, must not be empty
ALTER TABLE app_evaluation_pathway 
ADD CONSTRAINT chk_app_evaluation_pathway_project_name_not_empty 
CHECK (project_name IS NULL OR TRIM(project_name) <> '');

-- Add comment
COMMENT ON CONSTRAINT chk_app_evaluation_pathway_pathway_name_not_empty ON app_evaluation_pathway IS 
  'Ensures pathway_name, if provided, is not an empty string. NULL values are allowed.';

COMMENT ON CONSTRAINT chk_app_evaluation_pathway_project_name_not_empty ON app_evaluation_pathway IS 
  'Ensures project_name, if provided, is not an empty string. NULL values are allowed.';
