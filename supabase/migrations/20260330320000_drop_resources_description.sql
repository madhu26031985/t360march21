-- Remove legacy description requirement from resources.
-- Safe to run whether or not the column/constraint already exists.
ALTER TABLE public.resources
DROP CONSTRAINT IF EXISTS chk_resources_description_not_empty;

ALTER TABLE public.resources
DROP COLUMN IF EXISTS description;
