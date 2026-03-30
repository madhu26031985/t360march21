-- One RPC for Meeting Agenda screen: meeting + club + officers + agenda rows + pathways +
-- grammarian rows + booked prepared roles + profile map + evaluation PDF rows.
-- Replaces ~10+ parallel PostgREST round-trips with one HTTP call.

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
  SELECT m.club_id, to_jsonb(m)
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
      SELECT to_jsonb(cp)
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
            to_jsonb(mai)
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
      SELECT to_jsonb(w)
      FROM public.grammarian_word_of_the_day w
      WHERE w.meeting_id = p_meeting_id
        AND w.is_published = true
      LIMIT 1
    ),
    'grammarian_idiom_of_the_day',
    (
      SELECT to_jsonb(i)
      FROM public.grammarian_idiom_of_the_day i
      WHERE i.meeting_id = p_meeting_id
        AND i.is_published = true
      LIMIT 1
    ),
    'grammarian_quote_of_the_day',
    (
      SELECT to_jsonb(q)
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
            'avatar_url', p.avatar_url
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
  'Authenticated club members: full meeting agenda payload in one JSON response.';

GRANT EXECUTE ON FUNCTION public.get_meeting_agenda_snapshot(uuid) TO authenticated;

ALTER FUNCTION public.get_meeting_agenda_snapshot(uuid) SET row_security = off;

ANALYZE public.meeting_agenda_items;
ANALYZE public.app_evaluation_pathway;
ANALYZE public.app_user_profiles;
