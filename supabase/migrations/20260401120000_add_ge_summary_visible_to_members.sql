-- General Evaluator: allow GE/VPE to hide score summary from regular members (Summary tab).
ALTER TABLE public.app_meeting_ge
  ADD COLUMN IF NOT EXISTS summary_visible_to_members boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.app_meeting_ge.summary_visible_to_members IS
  'When false, non-GE members do not see scores on General Evaluator Summary; GE and VPE always see full report.';
