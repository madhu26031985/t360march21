-- Evaluation Corner performance: fast snapshot lookups for one meeting.

-- Pathway fetch/update patterns:
-- - WHERE meeting_id = ?
-- - WHERE meeting_id = ? AND user_id = ? AND role_name = ?
CREATE INDEX IF NOT EXISTS idx_eval_pathway_meeting_user_role
  ON public.app_evaluation_pathway (meeting_id, user_id, role_name);

CREATE INDEX IF NOT EXISTS idx_eval_pathway_meeting
  ON public.app_evaluation_pathway (meeting_id);

-- Roles list pattern in get_evaluation_corner_snapshot():
-- WHERE meeting_id = ? AND role_status = 'Available' AND role set filters.
CREATE INDEX IF NOT EXISTS idx_mrm_eval_corner_meeting_available_filtered
  ON public.app_meeting_roles_management (meeting_id, booking_status, role_name)
  WHERE role_status = 'Available'
    AND (
      role_classification = 'Prepared Speaker'
      OR role_name ILIKE '%prepared%speaker%'
      OR role_name ILIKE '%evaluator%'
    );

ANALYZE public.app_evaluation_pathway;
ANALYZE public.app_meeting_roles_management;
