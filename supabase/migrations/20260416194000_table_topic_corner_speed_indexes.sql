-- Speed up Table Topic Corner snapshot reads used by Home -> Table Topic Corner.
-- Targets the meeting role scans for TT Master and participants.

CREATE INDEX IF NOT EXISTS idx_mrm_meeting_available_order
  ON public.app_meeting_roles_management (meeting_id, role_status, order_index);

CREATE INDEX IF NOT EXISTS idx_mrm_meeting_available_booked
  ON public.app_meeting_roles_management (meeting_id, role_status, booking_status);

ANALYZE public.app_meeting_roles_management;
