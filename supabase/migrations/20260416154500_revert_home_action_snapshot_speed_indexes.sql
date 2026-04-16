/*
  Revert 20260416153000_home_action_snapshot_speed_indexes.sql

  Drops only the indexes added by that migration.
*/

DROP INDEX IF EXISTS public.idx_club_user_rel_club_user_auth;
DROP INDEX IF EXISTS public.idx_mrm_meeting_toastmaster_booked;
DROP INDEX IF EXISTS public.idx_mrm_meeting_general_evaluator_booked;
DROP INDEX IF EXISTS public.idx_mrm_meeting_table_topic_master_booked;
DROP INDEX IF EXISTS public.idx_mrm_meeting_table_topic_participants;
DROP INDEX IF EXISTS public.idx_toastmaster_meeting_data_snapshot;

ANALYZE public.app_club_user_relationship;
ANALYZE public.app_meeting_roles_management;
ANALYZE public.toastmaster_meeting_data;
