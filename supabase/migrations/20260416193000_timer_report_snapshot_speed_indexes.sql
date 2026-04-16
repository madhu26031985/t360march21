-- Speed up Timer report snapshot reads used by Home -> Timer navigation.
-- Targets:
-- 1) timer_reports filtered by meeting_id and ordered by recorded_at desc
-- 2) app_timer_selected_members filtered by meeting_id + timer_user_id

CREATE INDEX IF NOT EXISTS idx_timer_reports_meeting_recorded_at
  ON public.timer_reports (meeting_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_timer_selected_members_meeting_timer
  ON public.app_timer_selected_members (meeting_id, timer_user_id);

ANALYZE public.timer_reports;
ANALYZE public.app_timer_selected_members;
