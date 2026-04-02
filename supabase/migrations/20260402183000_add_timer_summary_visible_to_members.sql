ALTER TABLE public.timer_reports
ADD COLUMN IF NOT EXISTS summary_visible_to_members boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.timer_reports.summary_visible_to_members IS
  'When true, Timer Summary is visible to members in Timer Report details.';
