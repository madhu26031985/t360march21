/*
  # Fix All Functions Search Path

  ## Problem
  All database functions have search_path="" (empty string) which means they
  cannot resolve unqualified table names. This breaks all function calls
  including refresh_poll_results, create_poll_with_question_set, and all
  trigger functions.

  ## Fix
  Set search_path=public on all functions so they can resolve table names.
  This is done using ALTER FUNCTION ... SET search_path = public.
*/

DO $$
DECLARE
  r RECORD;
  sql_cmd TEXT;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, p.proargtypes, n.nspname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proconfig IS NOT NULL
      AND 'search_path=""' = ANY(p.proconfig)
  LOOP
    BEGIN
      sql_cmd := format('ALTER FUNCTION public.%I(%s) SET search_path = public',
        r.proname,
        pg_get_function_identity_arguments(r.oid)
      );
      EXECUTE sql_cmd;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not alter function %: %', r.proname, SQLERRM;
    END;
  END LOOP;
END $$;
