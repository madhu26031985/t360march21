-- Secondary club-tab speed indexes for date-bounded historical cards.

CREATE INDEX IF NOT EXISTS idx_app_club_meeting_club_date_id
  ON public.app_club_meeting (club_id, meeting_date DESC, id);

CREATE INDEX IF NOT EXISTS idx_grammarian_word_club_published_meeting
  ON public.grammarian_word_of_the_day (club_id, is_published, meeting_id);

CREATE INDEX IF NOT EXISTS idx_grammarian_idiom_club_published_meeting
  ON public.grammarian_idiom_of_the_day (club_id, is_published, meeting_id);

CREATE INDEX IF NOT EXISTS idx_grammarian_quote_club_published_meeting
  ON public.grammarian_quote_of_the_day (club_id, is_published, meeting_id);

CREATE INDEX IF NOT EXISTS idx_tabletopics_club_active_created
  ON public.app_meeting_tabletopicscorner (club_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_meeting_ge_club_status_meeting_eval
  ON public.app_meeting_ge (club_id, is_completed, booking_status, meeting_id, evaluator_user_id);

CREATE INDEX IF NOT EXISTS idx_ah_counter_reports_published_meeting_club_recorder
  ON public.ah_counter_reports (meeting_id, club_id, recorded_by)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_timer_reports_club_meeting_recorded_recorder
  ON public.timer_reports (club_id, meeting_id, recorded_at DESC, recorded_by);
