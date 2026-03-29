-- Speed up Toastmaster Corner parallel load: filter by meeting + club together
CREATE INDEX IF NOT EXISTS idx_toastmaster_meeting_data_meeting_club
  ON public.toastmaster_meeting_data (meeting_id, club_id);

ANALYZE public.toastmaster_meeting_data;
