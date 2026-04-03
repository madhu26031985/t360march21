-- Meeting agenda snapshot: smaller JSON for mobile/web (was ~1MB+ with to_jsonb(meeting), to_jsonb(mai), to_jsonb(club_profiles)).
-- - Meeting/club: only fields the Meeting Agenda screen uses.
-- - Agenda rows: explicit columns + template is_role_based (not whole-row jsonb).
-- - Grammarian bundles: display fields only.
-- - Profiles: reuse _timer_report_public_avatar (drop data: URLs / huge strings).

CREATE OR REPLACE FUNCTION public.get_meeting_agenda_snapshot(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_meeting jsonb;
BEGIN
  SELECT
    m.club_id,
    jsonb_build_object(
      'id', m.id,
      'club_id', m.club_id,
      'meeting_title', m.meeting_title,
      'meeting_date', m.meeting_date,
      'meeting_number', m.meeting_number,
      'meeting_start_time', m.meeting_start_time,
      'meeting_end_time', m.meeting_end_time,
      'meeting_mode', m.meeting_mode,
      'meeting_location', m.meeting_location,
      'meeting_link', m.meeting_link,
      'meeting_status', m.meeting_status,
      'theme', m.theme,
      'word_of_the_day', m.word_of_the_day,
      'phrase_of_the_day', m.phrase_of_the_day,
      'idiom_of_the_day', m.idiom_of_the_day,
      'quote_of_the_day', m.quote_of_the_day,
      'club_info_banner_color', m.club_info_banner_color,
      'datetime_banner_color', m.datetime_banner_color,
      'footer_banner_1_color', m.footer_banner_1_color,
      'footer_banner_2_color', m.footer_banner_2_color,
      'is_agenda_visible', m.is_agenda_visible,
      'public_agenda_skin', m.public_agenda_skin
    )
  INTO v_club_id, v_meeting
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
    'meeting', v_meeting,
    'club',
    (
      SELECT jsonb_build_object(
        'id', cp.id,
        'club_name', cp.club_name,
        'club_number', cp.club_number,
        'district', cp.district,
        'division', cp.division,
        'area', cp.area,
        'country', cp.country,
        'time_zone', cp.time_zone
      )
      FROM public.club_profiles cp
      WHERE cp.club_id = v_club_id
      LIMIT 1
    ),
    'vpm',
    (
      SELECT jsonb_build_object(
        'full_name', vp.full_name,
        'phone_number', vp.phone_number
      )
      FROM public.club_profiles cp
      JOIN public.app_user_profiles vp ON vp.id = cp.vpm_id
      WHERE cp.club_id = v_club_id
        AND cp.vpm_id IS NOT NULL
      LIMIT 1
    ),
    'vpe',
    (
      SELECT jsonb_build_object(
        'full_name', vp.full_name,
        'phone_number', vp.phone_number
      )
      FROM public.club_profiles cp
      JOIN public.app_user_profiles vp ON vp.id = cp.vpe_id
      WHERE cp.club_id = v_club_id
        AND cp.vpe_id IS NOT NULL
      LIMIT 1
    ),
    'agenda_items',
    (
      SELECT COALESCE(jsonb_agg(sub.item ORDER BY sub.section_order), '[]'::jsonb)
      FROM (
        SELECT
          mai.section_order,
          (
            jsonb_build_object(
              'id', mai.id,
              'section_name', mai.section_name,
              'section_description', mai.section_description,
              'section_icon', mai.section_icon,
              'section_order', mai.section_order,
              'start_time', mai.start_time,
              'end_time', mai.end_time,
              'duration_minutes', mai.duration_minutes,
              'assigned_user_id', mai.assigned_user_id,
              'assigned_user_name', mai.assigned_user_name,
              'timer_user_id', mai.timer_user_id,
              'ah_counter_user_id', mai.ah_counter_user_id,
              'grammarian_user_id', mai.grammarian_user_id,
              'timer_visible', mai.timer_visible,
              'ah_counter_visible', mai.ah_counter_visible,
              'grammarian_visible', mai.grammarian_visible,
              'role_details', mai.role_details,
              'prepared_speeches_agenda', mai.prepared_speeches_agenda,
              'educational_topic', mai.educational_topic,
              'custom_notes', mai.custom_notes,
              'is_visible', mai.is_visible
            )
            || jsonb_build_object(
              'agenda_item_templates',
              jsonb_build_object(
                'is_role_based', COALESCE(t.is_role_based, true)
              )
            )
          ) AS item
        FROM public.meeting_agenda_items mai
        LEFT JOIN public.agenda_item_templates t ON t.id = mai.template_id
        WHERE mai.meeting_id = p_meeting_id
          AND mai.is_visible = true
      ) sub
    ),
    'pathways',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'user_id', e.user_id,
            'role_name', e.role_name,
            'speech_title', e.speech_title,
            'pathway_name', e.pathway_name,
            'project_name', e.project_name,
            'level', e.level,
            'project_number', e.project_number,
            'assigned_evaluator_id', e.assigned_evaluator_id,
            'evaluation_form', e.evaluation_form
          )
          ORDER BY e.role_name
        )
        FROM public.app_evaluation_pathway e
        WHERE e.meeting_id = p_meeting_id
      ),
      '[]'::jsonb
    ),
    'grammarian_word_of_the_day',
    (
      SELECT jsonb_build_object(
        'word', w.word,
        'meaning', w.meaning,
        'usage', w.usage,
        'part_of_speech', w.part_of_speech
      )
      FROM public.grammarian_word_of_the_day w
      WHERE w.meeting_id = p_meeting_id
        AND w.is_published = true
      LIMIT 1
    ),
    'grammarian_idiom_of_the_day',
    (
      SELECT jsonb_build_object(
        'idiom', i.idiom,
        'meaning', i.meaning,
        'usage', i.usage
      )
      FROM public.grammarian_idiom_of_the_day i
      WHERE i.meeting_id = p_meeting_id
        AND i.is_published = true
      LIMIT 1
    ),
    'grammarian_quote_of_the_day',
    (
      SELECT jsonb_build_object(
        'quote', q.quote,
        'meaning', q.meaning,
        'usage', q.usage
      )
      FROM public.grammarian_quote_of_the_day q
      WHERE q.meeting_id = p_meeting_id
        AND q.is_published = true
      LIMIT 1
    ),
    'booked_prepared_roles',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'assigned_user_id', rm.assigned_user_id,
            'booking_status', rm.booking_status
          )
        )
        FROM public.app_meeting_roles_management rm
        WHERE rm.meeting_id = p_meeting_id
          AND rm.role_name ILIKE '%prepared%speaker%'
          AND rm.booking_status = 'booked'
      ),
      '[]'::jsonb
    ),
    'profiles',
    COALESCE(
      (
        SELECT jsonb_object_agg(
          p.id::text,
          jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'avatar_url', public._timer_report_public_avatar(p.avatar_url)
          )
        )
        FROM public.app_user_profiles p
        WHERE p.id IN (
          SELECT DISTINCT uid
          FROM (
            SELECT mai.assigned_user_id AS uid
            FROM public.meeting_agenda_items mai
            WHERE mai.meeting_id = p_meeting_id
              AND mai.is_visible = true
              AND mai.assigned_user_id IS NOT NULL
            UNION
            SELECT mai.timer_user_id AS uid
            FROM public.meeting_agenda_items mai
            WHERE mai.meeting_id = p_meeting_id
              AND mai.is_visible = true
              AND mai.timer_user_id IS NOT NULL
            UNION
            SELECT mai.ah_counter_user_id AS uid
            FROM public.meeting_agenda_items mai
            WHERE mai.meeting_id = p_meeting_id
              AND mai.is_visible = true
              AND mai.ah_counter_user_id IS NOT NULL
            UNION
            SELECT mai.grammarian_user_id AS uid
            FROM public.meeting_agenda_items mai
            WHERE mai.meeting_id = p_meeting_id
              AND mai.is_visible = true
              AND mai.grammarian_user_id IS NOT NULL
            UNION
            SELECT e.user_id AS uid
            FROM public.app_evaluation_pathway e
            WHERE e.meeting_id = p_meeting_id
              AND e.user_id IS NOT NULL
            UNION
            SELECT e.assigned_evaluator_id AS uid
            FROM public.app_evaluation_pathway e
            WHERE e.meeting_id = p_meeting_id
              AND e.assigned_evaluator_id IS NOT NULL
          ) uids
        )
      ),
      '{}'::jsonb
    ),
    'evaluations',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ev.id,
            'evaluation_pathway_id', ev.evaluation_pathway_id,
            'evaluation_pdf_url', ev.evaluation_pdf_url
          )
        )
        FROM public.app_prepared_speech_evaluations ev
        WHERE ev.evaluation_pathway_id IN (
          SELECT e.id FROM public.app_evaluation_pathway e WHERE e.meeting_id = p_meeting_id
        )
      ),
      '[]'::jsonb
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_meeting_agenda_snapshot(uuid) IS
  'Authenticated club members: slim meeting agenda JSON (small payload for mobile).';
