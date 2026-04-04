-- app_meeting_ge: allow INSERT/UPDATE for assigned General Evaluator OR club VPE.
-- (Repo previously only had SELECT RLS; production may have had permissive defaults.
--  This migration makes VPE writes explicit and safe.)

DROP POLICY IF EXISTS "app_meeting_ge_insert_ge_or_vpe" ON public.app_meeting_ge;
DROP POLICY IF EXISTS "app_meeting_ge_update_ge_or_vpe" ON public.app_meeting_ge;

CREATE POLICY "app_meeting_ge_insert_ge_or_vpe"
  ON public.app_meeting_ge
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_ge.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = app_meeting_ge.meeting_id
        AND rm.assigned_user_id = app_meeting_ge.evaluator_user_id
        AND lower(rm.role_name) LIKE '%general evaluator%'
        AND rm.booking_status = 'booked'
    )
    AND (
      app_meeting_ge.evaluator_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.club_profiles cp
        WHERE cp.club_id = app_meeting_ge.club_id
          AND cp.vpe_id = auth.uid()
      )
    )
  );

CREATE POLICY "app_meeting_ge_update_ge_or_vpe"
  ON public.app_meeting_ge
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_ge.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
    AND (
      app_meeting_ge.evaluator_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.club_profiles cp
        WHERE cp.club_id = app_meeting_ge.club_id
          AND cp.vpe_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_ge.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.app_meeting_roles_management rm
      WHERE rm.meeting_id = app_meeting_ge.meeting_id
        AND rm.assigned_user_id = app_meeting_ge.evaluator_user_id
        AND lower(rm.role_name) LIKE '%general evaluator%'
        AND rm.booking_status = 'booked'
    )
    AND (
      app_meeting_ge.evaluator_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.club_profiles cp
        WHERE cp.club_id = app_meeting_ge.club_id
          AND cp.vpe_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY "app_meeting_ge_insert_ge_or_vpe" ON public.app_meeting_ge IS
  'Insert GE report row for the booked evaluator user id; assigned GE or VPE only.';

COMMENT ON POLICY "app_meeting_ge_update_ge_or_vpe" ON public.app_meeting_ge IS
  'Update GE report row; assigned GE or VPE only.';
