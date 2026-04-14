-- Club tab secondary payload in one RPC round-trip.
-- Aggregates historical highlights for the last N months on server-side.

CREATE OR REPLACE FUNCTION public.get_club_tab_secondary_snapshot(
  p_club_id uuid,
  p_months integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_months integer := GREATEST(1, LEAST(COALESCE(p_months, 6), 24));
  v_from date := (CURRENT_DATE - make_interval(months => v_months))::date;
  v_to date := CURRENT_DATE;
BEGIN
  IF p_club_id IS NULL OR auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_club_user_relationship r
    WHERE r.club_id = p_club_id
      AND r.user_id = auth.uid()
      AND r.is_authenticated = true
  ) THEN
    RETURN NULL;
  END IF;

  RETURN (
    WITH meetings_in_range AS (
      SELECT m.id, m.meeting_date, m.meeting_number
      FROM public.app_club_meeting m
      WHERE m.club_id = p_club_id
        AND m.meeting_date BETWEEN v_from AND v_to
    ),

    quotes AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'lead', q.quote,
          'meaning', q.meaning,
          'usage', q.usage,
          'meetingDateLabel', to_char(m.meeting_date, 'Mon FMDD, YYYY'),
          'addedBy', COALESCE(up.full_name, '—'),
          'meetingDateRaw', m.meeting_date::text
        )
        ORDER BY m.meeting_date DESC
      ) AS rows
      FROM public.grammarian_quote_of_the_day q
      INNER JOIN meetings_in_range m ON m.id = q.meeting_id
      LEFT JOIN public.app_user_profiles up ON up.id = q.grammarian_user_id
      WHERE q.club_id = p_club_id
        AND q.is_published = true
        AND COALESCE(nullif(trim(q.quote), ''), '') <> ''
    ),

    idioms AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'lead', i.idiom,
          'meaning', i.meaning,
          'usage', i.usage,
          'meetingDateLabel', to_char(m.meeting_date, 'Mon FMDD, YYYY'),
          'addedBy', COALESCE(up.full_name, '—'),
          'meetingDateRaw', m.meeting_date::text
        )
        ORDER BY m.meeting_date DESC
      ) AS rows
      FROM public.grammarian_idiom_of_the_day i
      INNER JOIN meetings_in_range m ON m.id = i.meeting_id
      LEFT JOIN public.app_user_profiles up ON up.id = i.grammarian_user_id
      WHERE i.club_id = p_club_id
        AND i.is_published = true
        AND COALESCE(nullif(trim(i.idiom), ''), '') <> ''
    ),

    words AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', w.id,
          'word', w.word,
          'meaning', w.meaning,
          'partOfSpeech', w.part_of_speech,
          'usage', w.usage,
          'meetingDateLabel', to_char(m.meeting_date, 'Mon FMDD, YYYY'),
          'addedBy', COALESCE(up.full_name, '—'),
          'meetingDateRaw', m.meeting_date::text
        )
        ORDER BY m.meeting_date DESC
      ) AS rows
      FROM public.grammarian_word_of_the_day w
      INNER JOIN meetings_in_range m ON m.id = w.meeting_id
      LEFT JOIN public.app_user_profiles up ON up.id = w.grammarian_user_id
      WHERE w.club_id = p_club_id
        AND w.is_published = true
        AND COALESCE(nullif(trim(w.word), ''), '') <> ''
    ),

    table_topics AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'question', t.question_text,
          'createdAt', t.created_at,
          'meetingDateLabel', to_char((t.created_at::date), 'Mon FMDD, YYYY'),
          'addedBy', COALESCE(up.full_name, t.asked_by_name, '—')
        )
        ORDER BY t.created_at DESC
      ) AS rows
      FROM public.app_meeting_tabletopicscorner t
      LEFT JOIN public.app_user_profiles up
        ON up.id = COALESCE(t.created_by, t.user_id, t.added_by, t.asked_by)
      WHERE t.club_id = p_club_id
        AND t.is_active = true
        AND t.created_at::date BETWEEN v_from AND v_to
        AND COALESCE(nullif(trim(t.question_text), ''), '') <> ''
    ),

    ge_scoring AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', g.id,
          'evaluatorName', COALESCE(up.full_name, 'General Evaluator'),
          'evaluatorAvatarUrl', up.avatar_url,
          'meetingDateRaw', m.meeting_date::text,
          'meetingDateLabel', to_char(m.meeting_date, 'Mon FMDD, YYYY'),
          'meetingNumber', m.meeting_number,
          'score', CASE
            WHEN (g.evaluation_data ->> 'q10_overall_experience') ~ '^[0-9]+(\.[0-9]+)?$'
              THEN round((g.evaluation_data ->> 'q10_overall_experience')::numeric)::int
            ELSE NULL
          END,
          'overallScoreTotal',
            (SELECT COALESCE(sum(round((j.value)::numeric)::int), 0)
             FROM jsonb_each_text(COALESCE(g.evaluation_data, '{}'::jsonb)) j
             WHERE j.value ~ '^[0-9]+(\.[0-9]+)?$'),
          'overallScoreMax',
            (SELECT COALESCE(count(*), 0) * 10
             FROM jsonb_each_text(COALESCE(g.evaluation_data, '{}'::jsonb)) j
             WHERE j.value ~ '^[0-9]+(\.[0-9]+)?$')
        )
        ORDER BY m.meeting_date DESC
      ) AS rows
      FROM public.app_meeting_ge g
      INNER JOIN meetings_in_range m ON m.id = g.meeting_id
      LEFT JOIN public.app_user_profiles up ON up.id = g.evaluator_user_id
      WHERE g.club_id = p_club_id
        AND g.booking_status = 'booked'
        AND g.is_completed = true
    ),

    timer_base AS (
      SELECT
        tr.meeting_id,
        tr.recorded_by,
        sum(CASE WHEN lower(tr.speech_category) IN ('prepared_speech','prepared_speeches','prepared speech') THEN 1 ELSE 0 END) AS prepared_total,
        sum(CASE WHEN lower(tr.speech_category) IN ('prepared_speech','prepared_speeches','prepared speech') AND tr.time_qualification THEN 1 ELSE 0 END) AS prepared_qualified,
        sum(CASE WHEN lower(tr.speech_category) IN ('evaluation','evaluations') THEN 1 ELSE 0 END) AS evaluation_total,
        sum(CASE WHEN lower(tr.speech_category) IN ('evaluation','evaluations') AND tr.time_qualification THEN 1 ELSE 0 END) AS evaluation_qualified,
        sum(CASE WHEN lower(tr.speech_category) IN ('table_topic_speaker','table_topic_speakers','table topic speaker') THEN 1 ELSE 0 END) AS tt_total,
        sum(CASE WHEN lower(tr.speech_category) IN ('table_topic_speaker','table_topic_speakers','table topic speaker') AND tr.time_qualification THEN 1 ELSE 0 END) AS tt_qualified,
        sum(CASE WHEN lower(tr.speech_category) IN ('educational_session','educational_speech','educational speech') THEN 1 ELSE 0 END) AS edu_total,
        sum(CASE WHEN lower(tr.speech_category) IN ('educational_session','educational_speech','educational speech') AND tr.time_qualification THEN 1 ELSE 0 END) AS edu_qualified
      FROM public.timer_reports tr
      INNER JOIN meetings_in_range m ON m.id = tr.meeting_id
      WHERE tr.club_id = p_club_id
      GROUP BY tr.meeting_id, tr.recorded_by
    ),

    timer_ranked AS (
      SELECT DISTINCT ON (tb.meeting_id)
        tb.*,
        m.meeting_date,
        m.meeting_number
      FROM timer_base tb
      INNER JOIN meetings_in_range m ON m.id = tb.meeting_id
      ORDER BY tb.meeting_id, (tb.prepared_total + tb.evaluation_total + tb.tt_total + tb.edu_total) DESC
    ),

    timer_rows AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', tr.meeting_id,
          'meetingDateRaw', tr.meeting_date::text,
          'meetingDateLabel', to_char(tr.meeting_date, 'Mon FMDD, YYYY'),
          'meetingNumber', tr.meeting_number,
          'timerName', COALESCE(up.full_name, 'Timer'),
          'timerAvatarUrl', up.avatar_url,
          'categoryStats', jsonb_build_array(
            jsonb_build_object('key','prepared_speeches','label','Prepared speeches','qualified',tr.prepared_qualified,'total',tr.prepared_total),
            jsonb_build_object('key','evaluation','label','Evaluation','qualified',tr.evaluation_qualified,'total',tr.evaluation_total),
            jsonb_build_object('key','table_topic_speakers','label','Table topic speakers','qualified',tr.tt_qualified,'total',tr.tt_total),
            jsonb_build_object('key','educational_speech','label','Educational speech','qualified',tr.edu_qualified,'total',tr.edu_total)
          )
        )
        ORDER BY tr.meeting_date DESC
      ) AS rows
      FROM timer_ranked tr
      LEFT JOIN public.app_user_profiles up ON up.id = tr.recorded_by
    ),

    ah_entries AS (
      SELECT
        a.meeting_id,
        a.recorded_by,
        jsonb_each_text(
          jsonb_strip_nulls(
            jsonb_build_object(
              'Um', a.um_count, 'Uh', a.uh_count, 'Ah', a.ah_count, 'Er', a.er_count, 'Hmm', a.hmm_count,
              'Like', a.like_count, 'So', a.so_count, 'Well', a.well_count, 'Okay', a.okay_count, 'You know', a.you_know_count,
              'Right', a.right_count, 'Actually', a.actually_count, 'Basically', a.basically_count, 'Literally', a.literally_count,
              'I mean', a.i_mean_count, 'You see', a.you_see_count
            )
          )
        ) AS kv
      FROM public.ah_counter_reports a
      INNER JOIN meetings_in_range m ON m.id = a.meeting_id
      WHERE a.club_id = p_club_id
        AND COALESCE(a.is_published, false) = true
    ),

    ah_agg AS (
      SELECT
        ae.meeting_id,
        ae.recorded_by,
        (ae.kv).key AS label,
        sum(CASE WHEN (ae.kv).value ~ '^[0-9]+$' THEN ((ae.kv).value)::int ELSE 0 END) AS cnt
      FROM ah_entries ae
      GROUP BY ae.meeting_id, ae.recorded_by, (ae.kv).key
      HAVING sum(CASE WHEN (ae.kv).value ~ '^[0-9]+$' THEN ((ae.kv).value)::int ELSE 0 END) > 0
    ),

    ah_ranked AS (
      SELECT
        aa.*,
        row_number() OVER (PARTITION BY aa.meeting_id ORDER BY aa.cnt DESC, aa.label ASC) AS rn
      FROM ah_agg aa
    ),

    ah_rows AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', m.id,
          'meetingDateRaw', m.meeting_date::text,
          'meetingDateLabel', to_char(m.meeting_date, 'Mon FMDD, YYYY'),
          'meetingNumber', m.meeting_number,
          'ahCounterName', COALESCE(up.full_name, 'Ah Counter'),
          'ahCounterAvatarUrl', up.avatar_url,
          'words', COALESCE(
            (
              SELECT jsonb_agg(jsonb_build_object('label', r.label, 'count', r.cnt) ORDER BY r.cnt DESC, r.label ASC)
              FROM ah_ranked r
              WHERE r.meeting_id = m.id
                AND r.rn <= 8
            ),
            '[]'::jsonb
          )
        )
        ORDER BY m.meeting_date DESC
      ) AS rows
      FROM meetings_in_range m
      LEFT JOIN LATERAL (
        SELECT DISTINCT ON (r.meeting_id) r.recorded_by
        FROM ah_ranked r
        WHERE r.meeting_id = m.id
        ORDER BY r.meeting_id, r.rn
      ) ah_top ON true
      LEFT JOIN public.app_user_profiles up ON up.id = ah_top.recorded_by
      WHERE EXISTS (SELECT 1 FROM ah_ranked r WHERE r.meeting_id = m.id)
    ),

    ed_rows AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', concat(es.meeting_id, ':', es.speaker_user_id),
          'speechTitle', es.speech_title,
          'speakerName', COALESCE(up.full_name, 'Member'),
          'avatarUrl', up.avatar_url,
          'meetingDateRaw', m.meeting_date::text,
          'meetingDateLabel', to_char(m.meeting_date, 'Mon FMDD, YYYY')
        )
        ORDER BY m.meeting_date DESC
      ) AS rows
      FROM public.app_meeting_educational_speaker es
      INNER JOIN meetings_in_range m ON m.id = es.meeting_id
      LEFT JOIN public.app_user_profiles up ON up.id = es.speaker_user_id
      WHERE es.club_id = p_club_id
        AND COALESCE(nullif(trim(es.speech_title), ''), '') <> ''
    ),

    tm_rows AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', concat(tmd.meeting_id, ':', tmd.toastmaster_user_id),
          'themeTitle', tmd.theme_of_the_day,
          'toastmasterName', COALESCE(up.full_name, 'Toastmaster'),
          'avatarUrl', up.avatar_url,
          'meetingDateRaw', m.meeting_date::text,
          'meetingDateLabel', to_char(m.meeting_date, 'Mon FMDD, YYYY')
        )
        ORDER BY m.meeting_date DESC
      ) AS rows
      FROM public.toastmaster_meeting_data tmd
      INNER JOIN meetings_in_range m ON m.id = tmd.meeting_id
      LEFT JOIN public.app_user_profiles up ON up.id = tmd.toastmaster_user_id
      WHERE tmd.club_id = p_club_id
        AND COALESCE(nullif(trim(tmd.theme_of_the_day), ''), '') <> ''
    ),

    prep_rows AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', concat(ep.meeting_id, ':', ep.user_id),
          'speechTitle', ep.speech_title,
          'speakerName', COALESCE(up.full_name, ep.speaker_name, 'Speaker'),
          'avatarUrl', up.avatar_url,
          'meetingDateRaw', m.meeting_date::text,
          'meetingDateLabel', to_char(m.meeting_date, 'Mon FMDD, YYYY'),
          'pathwayName', ep.pathway_name,
          'pathwayLevel', ep.pathway_level,
          'projectNumber', ep.project_number
        )
        ORDER BY m.meeting_date DESC
      ) AS rows
      FROM public.app_evaluation_pathway ep
      INNER JOIN meetings_in_range m ON m.id = ep.meeting_id
      LEFT JOIN public.app_user_profiles up ON up.id = ep.user_id
      WHERE ep.role_name = 'Prepared Speaker'
        AND COALESCE(nullif(trim(ep.speech_title), ''), '') <> ''
    )

    SELECT jsonb_build_object(
      'educationalSpeeches', COALESCE((SELECT rows FROM ed_rows), '[]'::jsonb),
      'toastmasterThemes', COALESCE((SELECT rows FROM tm_rows), '[]'::jsonb),
      'preparedSpeeches', COALESCE((SELECT rows FROM prep_rows), '[]'::jsonb),
      'quoteRows', COALESCE((SELECT rows FROM quotes), '[]'::jsonb),
      'idiomRows', COALESCE((SELECT rows FROM idioms), '[]'::jsonb),
      'wotdRows', COALESCE((SELECT rows FROM words), '[]'::jsonb),
      'timerMeetingWiseRows', COALESCE((SELECT rows FROM timer_rows), '[]'::jsonb),
      'ahCounterMeetingWiseRows', COALESCE((SELECT rows FROM ah_rows), '[]'::jsonb),
      'tableTopicQuestionRows', COALESCE((SELECT rows FROM table_topics), '[]'::jsonb),
      'generalEvaluatorScoringRows', COALESCE((SELECT rows FROM ge_scoring), '[]'::jsonb)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_club_tab_secondary_snapshot(uuid, integer) IS
  'Club tab secondary payload (historical highlights/cards) for one-round-trip loads.';

GRANT EXECUTE ON FUNCTION public.get_club_tab_secondary_snapshot(uuid, integer) TO authenticated;
ALTER FUNCTION public.get_club_tab_secondary_snapshot(uuid, integer) SET row_security = off;
