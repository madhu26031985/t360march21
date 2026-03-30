/*
  Speeds up club roster queries filtered by club_id + is_authenticated
  (e.g. get_club_member_directory, legacy relationship embeds).
*/

CREATE INDEX IF NOT EXISTS idx_acur_club_id_authenticated
  ON public.app_club_user_relationship (club_id)
  WHERE is_authenticated = true;

COMMENT ON INDEX public.idx_acur_club_id_authenticated IS
  'Partial index for listing authenticated members by club (roster / assign UIs).';
