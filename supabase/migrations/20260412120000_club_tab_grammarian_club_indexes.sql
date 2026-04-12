/*
  Club tab loads published grammarian rows with `.eq('club_id', …).eq('is_published', true)`.
  Existing indexes target (meeting_id, is_published); these partial indexes speed club-scoped scans.
*/

CREATE INDEX IF NOT EXISTS idx_gqotd_club_published
  ON public.grammarian_quote_of_the_day (club_id)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_giod_club_published
  ON public.grammarian_idiom_of_the_day (club_id)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_gwotd_club_published
  ON public.grammarian_word_of_the_day (club_id)
  WHERE is_published = true;

ANALYZE public.grammarian_quote_of_the_day;
ANALYZE public.grammarian_idiom_of_the_day;
ANALYZE public.grammarian_word_of_the_day;
