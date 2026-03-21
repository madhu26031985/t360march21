/*
  # Fix Helper Functions Search Path

  ## Problem
  get_user_club_ids() and is_user_excomm_in_club() have search_path=""
  which means their internal queries cannot resolve the table names.
  This causes the RLS policies on app_club_user_relationship to silently
  return no rows, breaking all club-scoped queries.

  ## Fix
  Recreate both functions with explicit public. schema prefix on all table
  references and set search_path=public so they resolve correctly.
*/

CREATE OR REPLACE FUNCTION public.get_user_club_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT club_id
  FROM public.app_club_user_relationship
  WHERE user_id = auth.uid()
  AND is_authenticated = true;
$$;

CREATE OR REPLACE FUNCTION public.is_user_excomm_in_club(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_club_user_relationship
    WHERE club_id = p_club_id
    AND user_id = auth.uid()
    AND role IN ('excomm', 'president', 'vpe', 'vpm', 'vppr', 'secretary', 'treasurer', 'saa', 'ipp')
    AND is_authenticated = true
  );
$$;
