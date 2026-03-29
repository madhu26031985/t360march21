-- Include meeting row in get_evaluation_corner_snapshot so the client uses one HTTP
-- call (one Slow-4G RTT + one preflight) instead of parallel meeting + snapshot.

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
    'meeting',
    (
      SELECT to_jsonb(mt)
      FROM public.app_club_meeting mt
      WHERE mt.id = p_meeting_id
    ),
    'pathways',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'meeting_id', e.meeting_id,
            'club_id', e.club_id,
            'user_id', e.user_id,
            'role_name', e.role_name,
            'speech_title', e.speech_title,
            'pathway_name', e.pathway_name,
            'level', e.level,
            'project_name', e.project_name,
            'evaluation_form', e.evaluation_form,
            'comments_for_evaluator', e.comments_for_evaluator,
            'evaluation_title', e.evaluation_title,
            'table_topics_title', e.table_topics_title,
            'assigned_evaluator_id', e.assigned_evaluator_id,
            'completed_evaluation_form', e.completed_evaluation_form,
            'comments_by_evaluator', e.comments_by_evaluator,
            'project_number', e.project_number,
            'created_at', e.created_at,
            'updated_at', e.updated_at,
            'updated_by', e.updated_by,
            'vpe_approval_requested', e.vpe_approval_requested,
            'vpe_approval_requested_at', e.vpe_approval_requested_at,
            'vpe_approval_request_id', e.vpe_approval_request_id,
            'vpe_approved', e.vpe_approved,
            'vpe_approved_at', e.vpe_approved_at,
            'vpe_approved_by', e.vpe_approved_by,
            'vpe_approval_decision_id', e.vpe_approval_decision_id,
            'is_locked', e.is_locked,
            'locked_at', e.locked_at
          )
        )
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
  'Authenticated club members: meeting row + evaluation pathways + roles in one JSON payload.';
