-- Per-meeting toggle: show/hide Table Topic Summary for members.
-- When false, only assigned Table Topic Master and VPE should manage/view summary content.

CREATE TABLE IF NOT EXISTS public.table_topic_corner_visibility (
  meeting_id uuid PRIMARY KEY REFERENCES public.app_club_meeting (id) ON DELETE CASCADE,
  summary_visible_to_members boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.table_topic_corner_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_topic_corner_visibility_select_club"
  ON public.table_topic_corner_visibility
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.app_club_user_relationship r
        ON r.club_id = m.club_id
       AND r.user_id = auth.uid()
       AND r.is_authenticated = true
      WHERE m.id = table_topic_corner_visibility.meeting_id
    )
  );

CREATE POLICY "table_topic_corner_visibility_insert_assigned_or_vpe"
  ON public.table_topic_corner_visibility
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = table_topic_corner_visibility.meeting_id
        AND rm.assigned_user_id = auth.uid()
        AND (
          rm.role_name ILIKE '%table topics master%'
          OR rm.role_name ILIKE '%table topic master%'
        )
        AND rm.booking_status = 'booked'
    )
    OR EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
      WHERE m.id = table_topic_corner_visibility.meeting_id
    )
  );

CREATE POLICY "table_topic_corner_visibility_update_assigned_or_vpe"
  ON public.table_topic_corner_visibility
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = table_topic_corner_visibility.meeting_id
        AND rm.assigned_user_id = auth.uid()
        AND (
          rm.role_name ILIKE '%table topics master%'
          OR rm.role_name ILIKE '%table topic master%'
        )
        AND rm.booking_status = 'booked'
    )
    OR EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
      WHERE m.id = table_topic_corner_visibility.meeting_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = table_topic_corner_visibility.meeting_id
        AND rm.assigned_user_id = auth.uid()
        AND (
          rm.role_name ILIKE '%table topics master%'
          OR rm.role_name ILIKE '%table topic master%'
        )
        AND rm.booking_status = 'booked'
    )
    OR EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
      WHERE m.id = table_topic_corner_visibility.meeting_id
    )
  );

COMMENT ON TABLE public.table_topic_corner_visibility IS
  'When false, Table Topic Summary is hidden from general members (Table Topic Master + VPE still see).';

GRANT SELECT, INSERT, UPDATE ON public.table_topic_corner_visibility TO authenticated;
