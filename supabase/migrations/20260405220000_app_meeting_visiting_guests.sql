-- Meeting visiting guests: up to 5 name-only slots per meeting for non-app visitors.
-- Used by Timer / Ah Counter / Grammarian (snapshots) and future voting (poll options can reference id).

-- ---------------------------------------------------------------------------
-- 1) Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_meeting_visiting_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.app_club_meeting (id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  slot_number smallint NOT NULL CHECK (slot_number >= 1 AND slot_number <= 5),
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_meeting_visiting_guests_meeting_slot_uniq UNIQUE (meeting_id, slot_number)
);

CREATE INDEX IF NOT EXISTS app_meeting_visiting_guests_meeting_id_idx
  ON public.app_meeting_visiting_guests (meeting_id);

CREATE INDEX IF NOT EXISTS app_meeting_visiting_guests_club_id_idx
  ON public.app_meeting_visiting_guests (club_id);

COMMENT ON TABLE public.app_meeting_visiting_guests IS
  'Up to five visiting guest names per meeting (no app account). Stable UUID per slot row for reports and voting.';

CREATE OR REPLACE FUNCTION public.app_meeting_visiting_guests_enforce_club()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_meeting_club uuid;
BEGIN
  SELECT m.club_id INTO v_meeting_club
  FROM public.app_club_meeting m
  WHERE m.id = NEW.meeting_id;
  IF v_meeting_club IS NULL THEN
    RAISE EXCEPTION 'Invalid meeting_id for visiting guest';
  END IF;
  IF NEW.club_id IS DISTINCT FROM v_meeting_club THEN
    RAISE EXCEPTION 'club_id must match meeting club';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_meeting_visiting_guests_club ON public.app_meeting_visiting_guests;
CREATE TRIGGER trg_app_meeting_visiting_guests_club
  BEFORE INSERT OR UPDATE OF meeting_id, club_id ON public.app_meeting_visiting_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.app_meeting_visiting_guests_enforce_club();

CREATE OR REPLACE FUNCTION public.app_meeting_visiting_guests_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_meeting_visiting_guests_updated_at ON public.app_meeting_visiting_guests;
CREATE TRIGGER trg_app_meeting_visiting_guests_updated_at
  BEFORE UPDATE ON public.app_meeting_visiting_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.app_meeting_visiting_guests_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) JSON helper for snapshots
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._meeting_visiting_guests_json(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'meeting_id', g.meeting_id,
          'club_id', g.club_id,
          'slot_number', g.slot_number,
          'display_name', g.display_name,
          'created_at', g.created_at,
          'updated_at', g.updated_at
        )
        ORDER BY g.slot_number
      )
      FROM public.app_meeting_visiting_guests g
      WHERE g.meeting_id = p_meeting_id
    ),
    '[]'::jsonb
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Who may edit roster
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_meeting_visiting_guests(p_meeting_id uuid, p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_club_user_relationship r
    WHERE r.club_id = p_club_id
      AND r.user_id = auth.uid()
      AND r.is_authenticated = true
  )
  AND (
    EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = p_club_id
        AND cp.vpe_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = p_meeting_id
        AND rm.assigned_user_id = auth.uid()
        AND rm.booking_status = 'booked'
        AND (
          lower(rm.role_name) LIKE '%timer%'
          OR lower(rm.role_name) LIKE '%ah%counter%'
          OR lower(rm.role_name) LIKE '%grammarian%'
        )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_meeting_visiting_guests(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_meeting_visiting_guests(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public._meeting_visiting_guests_json(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._meeting_visiting_guests_json(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_meeting_visiting_guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_meeting_visiting_guests_select_club ON public.app_meeting_visiting_guests;
CREATE POLICY app_meeting_visiting_guests_select_club
  ON public.app_meeting_visiting_guests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_visiting_guests.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

DROP POLICY IF EXISTS app_meeting_visiting_guests_insert_manage ON public.app_meeting_visiting_guests;
CREATE POLICY app_meeting_visiting_guests_insert_manage
  ON public.app_meeting_visiting_guests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_meeting_visiting_guests(meeting_id, club_id)
  );

DROP POLICY IF EXISTS app_meeting_visiting_guests_update_manage ON public.app_meeting_visiting_guests;
CREATE POLICY app_meeting_visiting_guests_update_manage
  ON public.app_meeting_visiting_guests
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_meeting_visiting_guests(meeting_id, club_id))
  WITH CHECK (public.can_manage_meeting_visiting_guests(meeting_id, club_id));

DROP POLICY IF EXISTS app_meeting_visiting_guests_delete_manage ON public.app_meeting_visiting_guests;
CREATE POLICY app_meeting_visiting_guests_delete_manage
  ON public.app_meeting_visiting_guests
  FOR DELETE
  TO authenticated
  USING (public.can_manage_meeting_visiting_guests(meeting_id, club_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_meeting_visiting_guests TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Optional FKs on report rows (nullable; populate from app over time)
-- ---------------------------------------------------------------------------
ALTER TABLE public.timer_reports
  ADD COLUMN IF NOT EXISTS visiting_guest_id uuid REFERENCES public.app_meeting_visiting_guests (id) ON DELETE SET NULL;

ALTER TABLE public.ah_counter_reports
  ADD COLUMN IF NOT EXISTS visiting_guest_id uuid REFERENCES public.app_meeting_visiting_guests (id) ON DELETE SET NULL;

ALTER TABLE public.grammarian_word_usage
  ADD COLUMN IF NOT EXISTS visiting_guest_id uuid REFERENCES public.app_meeting_visiting_guests (id) ON DELETE SET NULL;

ALTER TABLE public.grammarian_good_usage
  ADD COLUMN IF NOT EXISTS visiting_guest_id uuid REFERENCES public.app_meeting_visiting_guests (id) ON DELETE SET NULL;

ALTER TABLE public.grammarian_suggestions
  ADD COLUMN IF NOT EXISTS visiting_guest_id uuid REFERENCES public.app_meeting_visiting_guests (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.timer_reports.visiting_guest_id IS
  'When set, timer row is tied to app_meeting_visiting_guests (stable id for guests without app accounts).';

-- ---------------------------------------------------------------------------
-- 6) Timer snapshot: visiting_guests + extra timer_reports columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_timer_report_snapshot(
  p_meeting_id uuid,
  p_speech_category text DEFAULT 'prepared_speaker'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_bundle jsonb;
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

  v_bundle := public.get_timer_report_category_bundle(p_meeting_id, p_speech_category);

  RETURN jsonb_build_object(
    'meeting',
    (
      SELECT jsonb_build_object(
        'id', mt.id,
        'club_id', mt.club_id,
        'meeting_title', mt.meeting_title,
        'meeting_date', mt.meeting_date,
        'meeting_number', mt.meeting_number,
        'meeting_start_time', mt.meeting_start_time,
        'meeting_end_time', mt.meeting_end_time,
        'meeting_mode', mt.meeting_mode,
        'meeting_status', mt.meeting_status
      )
      FROM public.app_club_meeting mt
      WHERE mt.id = p_meeting_id
    ),
    'club_id', v_club_id,
    'member_directory',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'user_id', r.user_id,
            'full_name', COALESCE(p.full_name, ''),
            'email', COALESCE(p.email, ''),
            'avatar_url', public._timer_report_public_avatar(p.avatar_url)
          )
          ORDER BY COALESCE(p.full_name, '')
        )
        FROM public.app_club_user_relationship r
        INNER JOIN public.app_user_profiles p ON p.id = r.user_id
        WHERE r.club_id = v_club_id
          AND r.is_authenticated = true
      ),
      '[]'::jsonb
    ),
    'selected_member_ids',
    COALESCE(
      (
        SELECT jsonb_agg(tsm.selected_member_id ORDER BY tsm.selected_member_id)
        FROM public.app_timer_selected_members tsm
        WHERE tsm.meeting_id = p_meeting_id
          AND tsm.timer_user_id = auth.uid()
      ),
      '[]'::jsonb
    ),
    'assigned_timer',
    (
      SELECT
        CASE
          WHEN p.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'email', p.email,
            'avatar_url', public._timer_report_public_avatar(p.avatar_url)
          )
        END
      FROM public.app_meeting_roles_management rm
      INNER JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
      WHERE rm.meeting_id = p_meeting_id
        AND rm.role_name = 'Timer'
        AND rm.booking_status = 'booked'
      LIMIT 1
    ),
    'is_vpe',
    COALESCE(
      (
        SELECT (cp.vpe_id IS NOT NULL AND cp.vpe_id = auth.uid())
        FROM public.club_profiles cp
        WHERE cp.club_id = v_club_id
        LIMIT 1
      ),
      false
    ),
    'timer_reports',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', tr.id,
            'meeting_id', tr.meeting_id,
            'club_id', tr.club_id,
            'speaker_name', tr.speaker_name,
            'speaker_user_id', tr.speaker_user_id,
            'visiting_guest_id', tr.visiting_guest_id,
            'speech_category', tr.speech_category,
            'actual_time_seconds', tr.actual_time_seconds,
            'actual_time_display', tr.actual_time_display,
            'time_qualification', tr.time_qualification,
            'target_min_seconds', tr.target_min_seconds,
            'target_max_seconds', tr.target_max_seconds,
            'notes', tr.notes,
            'recorded_by', tr.recorded_by,
            'recorded_at', tr.recorded_at,
            'created_at', tr.created_at,
            'updated_at', tr.updated_at,
            'summary_visible_to_members', tr.summary_visible_to_members
          )
          ORDER BY tr.recorded_at DESC NULLS LAST
        )
        FROM (
          SELECT t.*
          FROM public.timer_reports t
          WHERE t.meeting_id = p_meeting_id
          ORDER BY t.recorded_at DESC NULLS LAST
          LIMIT 3000
        ) tr
      ),
      '[]'::jsonb
    ),
    'visiting_guests', public._meeting_visiting_guests_json(p_meeting_id),
    'category_roles', COALESCE(v_bundle->'category_roles', '[]'::jsonb),
    'booked_speakers', COALESCE(v_bundle->'booked_speakers', '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Ah Counter snapshots
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ah_counter_corner_snapshot(p_meeting_id uuid)
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
    'meeting', (
      SELECT jsonb_build_object(
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
        'meeting_status', m.meeting_status
      )
      FROM public.app_club_meeting m
      WHERE m.id = p_meeting_id
      LIMIT 1
    ),
    'assigned_ah_counter', (
      SELECT jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'avatar_url', public._timer_report_public_avatar(p.avatar_url)
      )
      FROM public.app_meeting_roles_management rm
      JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
      WHERE rm.meeting_id = p_meeting_id
        AND rm.role_name ILIKE '%Ah Counter%'
        AND rm.booking_status = 'booked'
        AND rm.assigned_user_id IS NOT NULL
      ORDER BY rm.role_name
      LIMIT 1
    ),
    'report_stats', jsonb_build_object(
      'total_speakers', COALESCE((
        SELECT count(*)
        FROM public.app_meeting_attendance a
        WHERE a.meeting_id = p_meeting_id
          AND a.club_id = v_club_id
          AND a.attendance_status IN ('present', 'late')
      ), 0),
      'completed_reports', COALESCE((
        SELECT count(*)
        FROM public.ah_counter_reports ar
        WHERE ar.meeting_id = p_meeting_id
          AND ar.club_id = v_club_id
          AND ar.is_published = true
      ), 0),
      'selected_members', COALESCE((
        SELECT count(*)
        FROM public.ah_counter_tracked_members tm
        WHERE tm.meeting_id = p_meeting_id
          AND tm.club_id = v_club_id
      ), 0)
    ),
    'is_excomm', COALESCE((
      SELECT (r.role = 'excomm')
      FROM public.app_club_user_relationship r
      WHERE r.club_id = v_club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
      LIMIT 1
    ), false),
    'is_vpe_for_club', COALESCE((
      SELECT (cp.vpe_id = auth.uid())
      FROM public.club_profiles cp
      WHERE cp.club_id = v_club_id
      LIMIT 1
    ), false),
    'report_rows', '[]'::jsonb,
    'audit_members', '[]'::jsonb,
    'published_count', COALESCE((
      SELECT count(*)
      FROM public.ah_counter_reports ar
      WHERE ar.meeting_id = p_meeting_id
        AND ar.club_id = v_club_id
        AND ar.is_published = true
    ), 0),
    'total_reports', COALESCE((
      SELECT count(*)
      FROM public.ah_counter_reports ar
      WHERE ar.meeting_id = p_meeting_id
        AND ar.club_id = v_club_id
    ), 0),
    'visiting_guests', public._meeting_visiting_guests_json(p_meeting_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ah_counter_corner_snapshot_small(p_meeting_id uuid)
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
    'meeting', (
      SELECT jsonb_build_object(
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
        'meeting_status', m.meeting_status
      )
      FROM public.app_club_meeting m
      WHERE m.id = p_meeting_id
      LIMIT 1
    ),
    'assigned_ah_counter', (
      SELECT jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'avatar_url', public._timer_report_public_avatar(p.avatar_url)
      )
      FROM public.app_meeting_roles_management rm
      JOIN public.app_user_profiles p ON p.id = rm.assigned_user_id
      WHERE rm.meeting_id = p_meeting_id
        AND rm.role_name ILIKE '%Ah Counter%'
        AND rm.booking_status = 'booked'
        AND rm.assigned_user_id IS NOT NULL
      ORDER BY rm.role_name
      LIMIT 1
    ),
    'report_stats', jsonb_build_object(
      'total_speakers', COALESCE((
        SELECT count(*)
        FROM public.app_meeting_attendance a
        WHERE a.meeting_id = p_meeting_id
          AND a.club_id = v_club_id
          AND a.attendance_status IN ('present', 'late')
      ), 0),
      'completed_reports', COALESCE((
        SELECT count(*)
        FROM public.ah_counter_reports ar
        WHERE ar.meeting_id = p_meeting_id
          AND ar.club_id = v_club_id
          AND ar.is_published = true
      ), 0),
      'selected_members', COALESCE((
        SELECT count(*)
        FROM public.ah_counter_tracked_members tm
        WHERE tm.meeting_id = p_meeting_id
          AND tm.club_id = v_club_id
      ), 0)
    ),
    'is_excomm', COALESCE((
      SELECT (r.role = 'excomm')
      FROM public.app_club_user_relationship r
      WHERE r.club_id = v_club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
      LIMIT 1
    ), false),
    'is_vpe_for_club', COALESCE((
      SELECT (cp.vpe_id = auth.uid())
      FROM public.club_profiles cp
      WHERE cp.club_id = v_club_id
      LIMIT 1
    ), false),
    'report_rows', '[]'::jsonb,
    'audit_members', '[]'::jsonb,
    'published_count', COALESCE((
      SELECT count(*)
      FROM public.ah_counter_reports ar
      WHERE ar.meeting_id = p_meeting_id
        AND ar.club_id = v_club_id
        AND ar.is_published = true
    ), 0),
    'total_reports', COALESCE((
      SELECT count(*)
      FROM public.ah_counter_reports ar
      WHERE ar.meeting_id = p_meeting_id
        AND ar.club_id = v_club_id
    ), 0),
    'visiting_guests', public._meeting_visiting_guests_json(p_meeting_id)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) Grammarian snapshot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_grammarian_corner_snapshot(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_assigned_grammarian_id uuid;
  v_effective_grammarian_id uuid;
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

  SELECT rm.assigned_user_id INTO v_assigned_grammarian_id
  FROM public.app_meeting_roles_management rm
  WHERE rm.meeting_id = p_meeting_id
    AND rm.booking_status = 'booked'
    AND rm.assigned_user_id IS NOT NULL
    AND lower(rm.role_name) LIKE '%grammarian%'
  ORDER BY rm.role_name
  LIMIT 1;

  v_effective_grammarian_id := COALESCE(v_assigned_grammarian_id, auth.uid());

  RETURN jsonb_build_object(
    'meeting_id', p_meeting_id,
    'club_id', v_club_id,
    'meeting', (
      SELECT jsonb_build_object(
        'id', mt.id,
        'meeting_title', mt.meeting_title,
        'meeting_date', mt.meeting_date,
        'meeting_number', mt.meeting_number,
        'meeting_start_time', mt.meeting_start_time,
        'meeting_end_time', mt.meeting_end_time,
        'meeting_mode', mt.meeting_mode,
        'meeting_status', mt.meeting_status
      )
      FROM public.app_club_meeting mt
      WHERE mt.id = p_meeting_id
      LIMIT 1
    ),
    'club_name', (SELECT c.name FROM public.clubs c WHERE c.id = v_club_id LIMIT 1),
    'assigned_grammarian',
    (
      SELECT jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'avatar_url', public._timer_report_public_avatar(p.avatar_url)
      )
      FROM public.app_user_profiles p
      WHERE p.id = v_assigned_grammarian_id
      LIMIT 1
    ),
    'is_vpe_for_club', COALESCE(
      (
        SELECT (cp.vpe_id = auth.uid())
        FROM public.club_profiles cp
        WHERE cp.club_id = v_club_id
        LIMIT 1
      ),
      false
    ),
    'daily_elements',
    CASE
      WHEN to_regclass('public.app_grammarian_daily_elements') IS NULL THEN NULL
      ELSE (
        SELECT jsonb_build_object(
          'word_of_the_day', d.word_of_the_day,
          'idiom_of_the_day', d.idiom_of_the_day,
          'phrase_of_the_day', d.phrase_of_the_day,
          'quote_of_the_day', d.quote_of_the_day
        )
        FROM public.app_grammarian_daily_elements d
        WHERE d.meeting_id = p_meeting_id
          AND d.grammarian_user_id = v_effective_grammarian_id
        ORDER BY d.created_at DESC
        LIMIT 1
      )
    END,
    'word_of_the_day', (
      SELECT jsonb_build_object(
        'id', w.id,
        'word', w.word,
        'part_of_speech', w.part_of_speech,
        'meaning', w.meaning,
        'usage', w.usage,
        'is_published', w.is_published,
        'created_at', w.created_at
      )
      FROM public.grammarian_word_of_the_day w
      WHERE w.meeting_id = p_meeting_id
        AND w.grammarian_user_id = v_effective_grammarian_id
      LIMIT 1
    ),
    'idiom_of_the_day', (
      SELECT jsonb_build_object(
        'id', i.id,
        'idiom', i.idiom,
        'meaning', i.meaning,
        'usage', i.usage,
        'is_published', i.is_published,
        'created_at', i.created_at,
        'grammarian_user_id', i.grammarian_user_id
      )
      FROM public.grammarian_idiom_of_the_day i
      WHERE i.meeting_id = p_meeting_id
        AND i.grammarian_user_id = v_effective_grammarian_id
      LIMIT 1
    ),
    'quote_of_the_day', (
      SELECT jsonb_build_object(
        'id', q.id,
        'quote', q.quote,
        'meaning', q.meaning,
        'usage', q.usage,
        'is_published', q.is_published,
        'created_at', q.created_at,
        'grammarian_user_id', q.grammarian_user_id
      )
      FROM public.grammarian_quote_of_the_day q
      WHERE q.meeting_id = p_meeting_id
        AND q.grammarian_user_id = v_effective_grammarian_id
      LIMIT 1
    ),
    'visiting_guests', public._meeting_visiting_guests_json(p_meeting_id),
    'has_published_live_observations', COALESCE(
      EXISTS (
        SELECT 1
        FROM public.grammarian_live_good_usage g
        WHERE g.meeting_id = p_meeting_id
          AND g.is_published = true
        LIMIT 1
      ) OR EXISTS (
        SELECT 1
        FROM public.grammarian_live_improvements i
        WHERE i.meeting_id = p_meeting_id
          AND i.is_published = true
        LIMIT 1
      ),
      false
    )
  );
END;
$$;

ANALYZE public.app_meeting_visiting_guests;
