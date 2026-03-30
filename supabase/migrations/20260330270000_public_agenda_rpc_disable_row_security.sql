/*
  Public agenda RPC runs as anon via PostgREST. RLS policies on meeting_agenda_items and
  app_user_profiles are TO authenticated only, so with default RLS evaluation the invoker
  (anon) sees no rows inside the SECURITY DEFINER function.

  SET row_security = off for this function only: the function still enforces is_agenda_visible
  and only returns fields it builds explicitly (no broad table exposure to clients).
*/

ALTER FUNCTION public.get_public_meeting_agenda_by_club(uuid, text, uuid) SET row_security = off;

COMMENT ON FUNCTION public.get_public_meeting_agenda_by_club(uuid, text, uuid) IS
  'Public agenda: meeting id + is_agenda_visible; row_security off inside function so anon RPC can read agenda rows and profile names for display.';
