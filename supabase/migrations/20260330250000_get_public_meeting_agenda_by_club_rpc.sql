/*
  Public agenda by stable IDs (no slug): club UUID + meeting number + meeting UUID must match.
  Fixes slug mismatches between JS NFKD slugify and SQL. GRANT to anon unchanged pattern.
*/

CREATE OR REPLACE FUNCTION public.get_public_meeting_agenda_by_club(
  p_club_id uuid,
  p_meeting_no text,
  p_meeting_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting public.app_club_meeting%ROWTYPE;
  v_expected_num text;
  v_num_param text;
BEGIN
  SELECT * INTO v_meeting FROM public.app_club_meeting WHERE id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_meeting.club_id IS DISTINCT FROM p_club_id THEN
    RETURN NULL;
  END IF;

  IF COALESCE(v_meeting.is_agenda_visible, true) = false THEN
    RETURN NULL;
  END IF;

  v_expected_num := regexp_replace(COALESCE(trim(v_meeting.meeting_number::text), ''), '[^a-zA-Z0-9._-]', '', 'g');
  IF v_expected_num IS NULL OR v_expected_num = '' THEN
    v_expected_num := '0';
  END IF;

  v_num_param := regexp_replace(COALESCE(trim(p_meeting_no), ''), '[^a-zA-Z0-9._-]', '', 'g');
  IF v_num_param IS NULL OR v_num_param = '' THEN
    v_num_param := '0';
  END IF;

  IF v_num_param IS DISTINCT FROM v_expected_num THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'meeting', jsonb_build_object(
      'id', v_meeting.id,
      'club_id', v_meeting.club_id,
      'meeting_title', v_meeting.meeting_title,
      'meeting_date', v_meeting.meeting_date,
      'meeting_number', v_meeting.meeting_number,
      'meeting_start_time', v_meeting.meeting_start_time,
      'meeting_end_time', v_meeting.meeting_end_time,
      'meeting_mode', v_meeting.meeting_mode,
      'meeting_location', v_meeting.meeting_location,
      'meeting_link', v_meeting.meeting_link,
      'club_info_banner_color', v_meeting.club_info_banner_color,
      'datetime_banner_color', v_meeting.datetime_banner_color
    ),
    'club', (
      SELECT jsonb_build_object(
        'club_name', COALESCE(cp.club_name, c.name),
        'club_number', COALESCE(cp.club_number, c.club_number)
      )
      FROM public.clubs c
      LEFT JOIN public.club_profiles cp ON cp.club_id = c.id
      WHERE c.id = v_meeting.club_id
      LIMIT 1
    ),
    'items', (
      SELECT COALESCE(jsonb_agg(x.item ORDER BY x.section_order), '[]'::jsonb)
      FROM (
        SELECT
          mai.section_order,
          jsonb_build_object(
            'section_name', mai.section_name,
            'section_description', mai.section_description,
            'section_icon', mai.section_icon,
            'section_order', mai.section_order,
            'duration_minutes', mai.duration_minutes,
            'assigned_user_name', NULLIF(trim(COALESCE(mai.assigned_user_name, ap_assigned.full_name, '')), ''),
            'timer_user_name', NULLIF(trim(COALESCE(ap_timer.full_name, '')), ''),
            'ah_counter_user_name', NULLIF(trim(COALESCE(ap_ah.full_name, '')), ''),
            'grammarian_user_name', NULLIF(trim(COALESCE(ap_gr.full_name, '')), ''),
            'role_details', mai.role_details,
            'prepared_speeches_agenda', mai.prepared_speeches_agenda,
            'educational_topic', mai.educational_topic,
            'custom_notes', mai.custom_notes
          ) AS item
        FROM public.meeting_agenda_items mai
        LEFT JOIN public.app_user_profiles ap_assigned ON ap_assigned.id = mai.assigned_user_id
        LEFT JOIN public.app_user_profiles ap_timer ON ap_timer.id = mai.timer_user_id
        LEFT JOIN public.app_user_profiles ap_ah ON ap_ah.id = mai.ah_counter_user_id
        LEFT JOIN public.app_user_profiles ap_gr ON ap_gr.id = mai.grammarian_user_id
        WHERE mai.meeting_id = p_meeting_id
          AND mai.is_visible = true
      ) x
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_public_meeting_agenda_by_club(uuid, text, uuid) IS
  'Public agenda: club_id + meeting_number + meeting_id must match; respects is_agenda_visible.';

GRANT EXECUTE ON FUNCTION public.get_public_meeting_agenda_by_club(uuid, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_meeting_agenda_by_club(uuid, text, uuid) TO authenticated;
