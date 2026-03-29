/*
  Evaluation corner / Prepared Speeches — backend support

  1. Partial index: only "Available" role rows per meeting (smaller than full table scans
     when filtering meeting_id + role_status = 'Available' + OR on role names).
  2. Optional RPC: single round-trip snapshot (pathways + roles + embedded profile fields).
     Wire from the client with supabase.rpc('get_evaluation_corner_snapshot', { p_meeting_id }).
  3. ANALYZE for planner stats.

  Note: get_club_member_directory + idx_acur_club_authenticated_user live in
  20260329140000_toastmaster_corner_member_directory_rpc.sql — apply that migration too
  if the assign-evaluator modal should use the RPC.
*/

-- Narrow partial index aligned with evaluation-corner loadRoleBookings filter
CREATE INDEX IF NOT EXISTS idx_mrm_meeting_available_eval_corner
  ON public.app_meeting_roles_management (meeting_id)
  WHERE role_status = 'Available';

ANALYZE public.app_meeting_roles_management;
ANALYZE public.app_evaluation_pathway;

-- ---------------------------------------------------------------------------
-- One-call snapshot for Prepared Speeches / evaluation-corner (optional use)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_evaluation_corner_snapshot(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  SELECT m.club_id INTO v_club_id
  FROM public.app_club_meeting m
  WHERE m.id = p_meeting_id;

  IF v_club_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_club_user_relationship r
    WHERE r.club_id = v_club_id
      AND r.user_id = auth.uid()
      AND r.is_authenticated = true
  ) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'meeting_id', p_meeting_id,
    'club_id', v_club_id,
    'pathways',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(e))
        FROM public.app_evaluation_pathway e
        WHERE e.meeting_id = p_meeting_id
      ),
      '[]'::jsonb
    ),
    'roles',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', rm.id,
            'assigned_user_id', rm.assigned_user_id,
            'role_name', rm.role_name,
            'role_metric', rm.role_metric,
            'booking_status', rm.booking_status,
            'role_classification', rm.role_classification,
            'role_status', rm.role_status,
            'app_user_profiles',
            CASE
              WHEN p.id IS NOT NULL THEN jsonb_build_object(
                'id', p.id,
                'full_name', p.full_name,
                'email', p.email,
                'avatar_url', p.avatar_url
              )
              ELSE NULL
            END
          )
        )
        FROM public.app_meeting_roles_management rm
        LEFT JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
        WHERE rm.meeting_id = p_meeting_id
          AND rm.role_status = 'Available'
          AND (
            rm.role_classification = 'Prepared Speaker'
            OR rm.role_name ILIKE '%prepared%speaker%'
            OR rm.role_name ILIKE '%evaluator%'
          )
      ),
      '[]'::jsonb
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_evaluation_corner_snapshot(uuid) IS
  'Authenticated club members: JSON snapshot of evaluation pathways + prepared-speaker/evaluator roles for a meeting (matches evaluation-corner filters).';

GRANT EXECUTE ON FUNCTION public.get_evaluation_corner_snapshot(uuid) TO authenticated;
