/*
  Home action snapshot speed indexes for 3G users.

  Targets the shared access pattern used by Home-launched snapshot RPCs:
  - membership check: app_club_user_relationship by (club_id, user_id, is_authenticated)
  - role snapshot lookup: app_meeting_roles_management by meeting + booked/available role slices
  - TMOD content lookup: toastmaster_meeting_data by (meeting_id, club_id, toastmaster_user_id)
  - timer selected members lookup: app_timer_selected_members by (meeting_id, timer_user_id)

  These indexes are additive and safe with existing broader indexes.
*/

-- Club-membership guard used by multiple SECURITY DEFINER snapshot RPCs.
CREATE INDEX IF NOT EXISTS idx_club_user_rel_club_user_auth
  ON public.app_club_user_relationship (club_id, user_id, is_authenticated);

-- Toastmaster snapshot: fast lookup for the booked toastmaster row.
CREATE INDEX IF NOT EXISTS idx_mrm_meeting_toastmaster_booked
  ON public.app_meeting_roles_management (meeting_id)
  WHERE role_status = 'Available'
    AND booking_status = 'booked'
    AND lower(role_name) LIKE '%toastmaster%';

-- General Evaluator snapshot: fast lookup for the booked GE row.
CREATE INDEX IF NOT EXISTS idx_mrm_meeting_general_evaluator_booked
  ON public.app_meeting_roles_management (meeting_id)
  WHERE role_status = 'Available'
    AND booking_status = 'booked'
    AND lower(role_name) LIKE '%general evaluator%';

-- Table Topic snapshot: master lookup.
CREATE INDEX IF NOT EXISTS idx_mrm_meeting_table_topic_master_booked
  ON public.app_meeting_roles_management (meeting_id)
  WHERE role_status = 'Available'
    AND booking_status = 'booked'
    AND assigned_user_id IS NOT NULL
    AND (
      role_name ILIKE '%Table Topics Master%'
      OR role_name ILIKE '%Table Topic Master%'
    );

-- Table Topic snapshot: participant list lookup ordered by role order.
CREATE INDEX IF NOT EXISTS idx_mrm_meeting_table_topic_participants
  ON public.app_meeting_roles_management (meeting_id, order_index)
  WHERE role_status = 'Available'
    AND (
      role_name ILIKE '%Table Topics Speaker%'
      OR role_name ILIKE '%Table Topic Speaker%'
      OR role_name ILIKE '%Table Topics Participant%'
      OR role_name ILIKE '%Table Topic Participant%'
    );

-- Toastmaster content row lookup.
CREATE INDEX IF NOT EXISTS idx_toastmaster_meeting_data_snapshot
  ON public.toastmaster_meeting_data (meeting_id, club_id, toastmaster_user_id, updated_at DESC);

ANALYZE public.app_club_user_relationship;
ANALYZE public.app_meeting_roles_management;
ANALYZE public.toastmaster_meeting_data;
ANALYZE public.app_timer_selected_members;
