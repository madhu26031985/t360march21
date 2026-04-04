/* Ah Counter report rows RPC: add visiting_guest_id for roster guests (same as Timer). */

CREATE OR REPLACE FUNCTION public.get_ah_counter_report_rows(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_privileged boolean;
  v_summary_visible boolean;
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

  v_privileged := EXISTS (
    SELECT 1
    FROM public.app_meeting_roles_management rm
    WHERE rm.meeting_id = p_meeting_id
      AND rm.assigned_user_id = auth.uid()
      AND rm.role_name ILIKE '%ah counter%'
      AND rm.booking_status = 'booked'
  ) OR EXISTS (
    SELECT 1
    FROM public.app_club_meeting m
    JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
    WHERE m.id = p_meeting_id
  );

  IF NOT v_privileged THEN
    SELECT COALESCE(
      (
        SELECT v.summary_visible_to_members
        FROM public.ah_counter_corner_visibility v
        WHERE v.meeting_id = p_meeting_id
      ),
      true
    ) INTO v_summary_visible;

    IF NOT v_summary_visible THEN
      RETURN '[]'::jsonb;
    END IF;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ar.id,
        'speaker_user_id', ar.speaker_user_id,
        'visiting_guest_id', ar.visiting_guest_id,
        'speaker_name', ar.speaker_name,
        'ah_count', ar.ah_count,
        'um_count', ar.um_count,
        'uh_count', ar.uh_count,
        'er_count', ar.er_count,
        'hmm_count', ar.hmm_count,
        'like_count', ar.like_count,
        'so_count', ar.so_count,
        'well_count', ar.well_count,
        'okay_count', ar.okay_count,
        'you_know_count', ar.you_know_count,
        'right_count', ar.right_count,
        'actually_count', ar.actually_count,
        'basically_count', ar.basically_count,
        'literally_count', ar.literally_count,
        'i_mean_count', ar.i_mean_count,
        'you_see_count', ar.you_see_count,
        'custom_filler_counts', COALESCE(ar.custom_filler_counts, '{}'::jsonb),
        'app_user_profiles',
          CASE
            WHEN p.id IS NOT NULL THEN jsonb_build_object(
              'avatar_url', public._timer_report_public_avatar(p.avatar_url)
            )
            ELSE NULL
          END
      )
      ORDER BY ar.speaker_name
    )
    FROM public.ah_counter_reports ar
    LEFT JOIN public.app_user_profiles p ON p.id = ar.speaker_user_id
    WHERE ar.meeting_id = p_meeting_id
      AND ar.club_id = v_club_id
  ), '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_ah_counter_report_rows(uuid) IS
  'Club members: Ah Counter rows when summary is visible, or always for assigned Ah Counter / VPE. Includes visiting_guest_id for roster guests.';
