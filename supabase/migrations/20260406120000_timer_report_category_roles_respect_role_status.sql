-- Timer report RPCs: only include roles that are not deleted in Manage Meeting Roles
-- (role_status NULL or 'Available'; exclude 'Deleted').

CREATE OR REPLACE FUNCTION public.get_timer_report_category_bundle(
  p_meeting_id uuid,
  p_speech_category text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_roles text[];
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

  v_roles := public._timer_report_role_names_for_category(p_speech_category);

  IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'category_roles', '[]'::jsonb,
      'booked_speakers', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'category_roles',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', rm.id,
            'role_name', rm.role_name,
            'booking_status', rm.booking_status,
            'assigned_user_id', rm.assigned_user_id,
            'completion_notes', rm.completion_notes,
            'role_status', rm.role_status,
            'app_user_profiles',
            CASE
              WHEN p.id IS NOT NULL THEN jsonb_build_object(
                'id', p.id,
                'full_name', p.full_name,
                'email', p.email,
                'avatar_url', public._timer_report_public_avatar(p.avatar_url)
              )
              ELSE NULL
            END
          )
          ORDER BY rm.role_name
        )
        FROM public.app_meeting_roles_management rm
        LEFT JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
        WHERE rm.meeting_id = p_meeting_id
          AND rm.role_name = ANY (v_roles)
          AND (rm.role_status IS NULL OR rm.role_status <> 'Deleted')
      ),
      '[]'::jsonb
    ),
    'booked_speakers',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'email', p.email,
            'avatar_url', public._timer_report_public_avatar(p.avatar_url)
          )
          ORDER BY p.full_name
        )
        FROM (
          SELECT DISTINCT rm.assigned_user_id AS uid
          FROM public.app_meeting_roles_management rm
          WHERE rm.meeting_id = p_meeting_id
            AND rm.role_name = ANY (v_roles)
            AND (rm.role_status IS NULL OR rm.role_status <> 'Deleted')
            AND rm.booking_status = 'booked'
            AND rm.assigned_user_id IS NOT NULL
        ) u
        INNER JOIN public.app_user_profiles p ON p.id = u.uid
      ),
      '[]'::jsonb
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_timer_report_category_bundle(uuid, text) IS
  'Category roles + booked_speakers for timer report; excludes role_status = Deleted.';
