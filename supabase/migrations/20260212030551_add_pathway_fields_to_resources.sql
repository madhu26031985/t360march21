/*
  # Add Pathway and Project Fields to Resources

  1. Changes
    - Add `pathway_name` column to resources table (optional text field)
    - Add `project_name` column to resources table (optional text field)
    - Add `project_number` column to resources table (optional integer field)
    - Add `level_number` column to resources table (optional integer field)
  
  2. Notes
    - These fields are optional (nullable) since they only apply to evaluation forms
    - Existing records will have NULL values for these fields
    - These fields help categorize evaluation forms by Toastmasters pathway information
*/

DO $$
BEGIN
  -- Add pathway_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resources' AND column_name = 'pathway_name'
  ) THEN
    ALTER TABLE resources ADD COLUMN pathway_name text;
  END IF;

  -- Add project_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resources' AND column_name = 'project_name'
  ) THEN
    ALTER TABLE resources ADD COLUMN project_name text;
  END IF;

  -- Add project_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resources' AND column_name = 'project_number'
  ) THEN
    ALTER TABLE resources ADD COLUMN project_number integer;
  END IF;

  -- Add level_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resources' AND column_name = 'level_number'
  ) THEN
    ALTER TABLE resources ADD COLUMN level_number integer;
  END IF;
END $$;