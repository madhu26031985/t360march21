-- Ah Counter: summary visibility (Timer-style) + VPE can manage tracked members + ILIKE Ah Counter role

-- ---------------------------------------------------------------------------
-- 1) Per-meeting visibility for Ah Counter Summary (members vs role-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ah_counter_corner_visibility (
  meeting_id uuid PRIMARY KEY REFERENCES public.app_club_meeting (id) ON DELETE CASCADE,
  summary_visible_to_members boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ah_counter_corner_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ah_counter_corner_visibility_select_club"
  ON public.ah_counter_corner_visibility
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
      WHERE m.id = ah_counter_corner_visibility.meeting_id
    )
  );

CREATE POLICY "ah_counter_corner_visibility_insert_assigned_or_vpe"
  ON public.ah_counter_corner_visibility
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = ah_counter_corner_visibility.meeting_id
        AND rm.assigned_user_id = auth.uid()
        AND rm.role_name ILIKE '%ah counter%'
        AND rm.booking_status = 'booked'
    )
    OR EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
      WHERE m.id = ah_counter_corner_visibility.meeting_id
    )
  );

CREATE POLICY "ah_counter_corner_visibility_update_assigned_or_vpe"
  ON public.ah_counter_corner_visibility
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = ah_counter_corner_visibility.meeting_id
        AND rm.assigned_user_id = auth.uid()
        AND rm.role_name ILIKE '%ah counter%'
        AND rm.booking_status = 'booked'
    )
    OR EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
      WHERE m.id = ah_counter_corner_visibility.meeting_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = ah_counter_corner_visibility.meeting_id
        AND rm.assigned_user_id = auth.uid()
        AND rm.role_name ILIKE '%ah counter%'
        AND rm.booking_status = 'booked'
    )
    OR EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
      WHERE m.id = ah_counter_corner_visibility.meeting_id
    )
  );

COMMENT ON TABLE public.ah_counter_corner_visibility IS
  'When false, Ah Counter Summary is hidden from general members (Ah Counter + VPE still see).';

-- ---------------------------------------------------------------------------
-- 2) VPE: insert/delete tracked members (manage-members screen)
-- ---------------------------------------------------------------------------
CREATE POLICY "VPE can insert ah counter tracked members"
  ON public.ah_counter_tracked_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
      WHERE m.id = ah_counter_tracked_members.meeting_id
    )
  );

CREATE POLICY "VPE can delete ah counter tracked members"
  ON public.ah_counter_tracked_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.app_club_meeting m
      JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
      WHERE m.id = ah_counter_tracked_members.meeting_id
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Relax assigned Ah Counter role match to ILIKE (matches app queries)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Ah Counter can insert tracked members" ON public.ah_counter_tracked_members;
CREATE POLICY "Ah Counter can insert tracked members"
  ON public.ah_counter_tracked_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    meeting_id IN (
      SELECT meeting_id
      FROM public.app_meeting_roles_management
      WHERE assigned_user_id = auth.uid()
        AND role_name ILIKE '%ah counter%'
        AND booking_status = 'booked'
    )
  );

DROP POLICY IF EXISTS "Ah Counter can delete tracked members" ON public.ah_counter_tracked_members;
CREATE POLICY "Ah Counter can delete tracked members"
  ON public.ah_counter_tracked_members
  FOR DELETE
  TO authenticated
  USING (
    meeting_id IN (
      SELECT meeting_id
      FROM public.app_meeting_roles_management
      WHERE assigned_user_id = auth.uid()
        AND role_name ILIKE '%ah counter%'
        AND booking_status = 'booked'
    )
  );
