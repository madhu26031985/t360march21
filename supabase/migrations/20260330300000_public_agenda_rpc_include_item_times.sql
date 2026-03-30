/* Public web minimal skin needs per-item start/end times (Notion-style time column). */

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
AS $function$
DECLARE
  v_meeting public.app_club_meeting%ROWTYPE;
  v_club jsonb;
  v_items jsonb;
BEGIN
  SELECT * INTO v_meeting FROM public.app_club_meeting WHERE id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'meeting_not_found',
      'message', 'No meeting exists for this link. It may have been removed, or the link was copied incorrectly.'
    );
  END IF;

  IF COALESCE(v_meeting.is_agenda_visible, true) = false THEN
    RETURN jsonb_build_object(
      'error', 'agenda_not_public',
      'message', 'This agenda is not shared publicly yet. ExComm can turn on public visibility in the agenda editor for this meeting.'
    );
  END IF;

  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'club_name',
        COALESCE(
          NULLIF(trim(COALESCE(cp.club_name, c.name, '')), ''),
          'Club'
        ),
        'club_number',
        COALESCE(cp.club_number, c.club_number)
      )
      FROM public.clubs c
      LEFT JOIN public.club_profiles cp ON cp.club_id = c.id
      WHERE c.id = v_meeting.club_id
      LIMIT 1
    ),
    jsonb_build_object('club_name', 'Club', 'club_number', null)
  )
  INTO v_club;

  SELECT COALESCE(jsonb_agg(sub.item ORDER BY sub.section_order), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      mai.section_order,
      jsonb_build_object(
        'section_name', mai.section_name,
        'section_description', mai.section_description,
        'section_icon', mai.section_icon,
        'section_order', mai.section_order,
        'duration_minutes', mai.duration_minutes,
        'start_time', mai.start_time,
        'end_time', mai.end_time,
        'assigned_user_name',
        NULLIF(trim(COALESCE(mai.assigned_user_name, ap_assigned.full_name, '')), ''),
        'timer_user_name',
        NULLIF(trim(COALESCE(ap_timer.full_name, '')), ''),
        'ah_counter_user_name',
        NULLIF(trim(COALESCE(ap_ah.full_name, '')), ''),
        'grammarian_user_name',
        NULLIF(trim(COALESCE(ap_gr.full_name, '')), ''),
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
  ) sub;

  RETURN jsonb_build_object(
    'meeting',
    jsonb_build_object(
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
      'datetime_banner_color', v_meeting.datetime_banner_color,
      'public_agenda_skin',
      CASE lower(trim(COALESCE(v_meeting.public_agenda_skin::text, '')))
        WHEN 'minimal' THEN 'minimal'
        WHEN 'vibrant' THEN 'vibrant'
        ELSE 'default'
      END
    ),
    'club',
    v_club,
    'items',
    v_items
  );
END;
$function$;

ALTER FUNCTION public.get_public_meeting_agenda_by_club(uuid, text, uuid) SET row_security = off;

COMMENT ON FUNCTION public.get_public_meeting_agenda_by_club(uuid, text, uuid) IS
  'Public agenda: returns meeting+club+items (including item times) as JSON {error, message} for not_found / not_public.';

