/*
  Additional targeted indexes for Meeting Agenda screen hot queries.
  Focus:
  - published grammarian daily entries by meeting
  - booked roles lookup by meeting
  - club profile lookup by club_id
*/

CREATE INDEX IF NOT EXISTS idx_grammarian_word_day_meeting_published
  ON public.grammarian_word_of_the_day (meeting_id, is_published);

CREATE INDEX IF NOT EXISTS idx_grammarian_idiom_day_meeting_published
  ON public.grammarian_idiom_of_the_day (meeting_id, is_published);

CREATE INDEX IF NOT EXISTS idx_grammarian_quote_day_meeting_published
  ON public.grammarian_quote_of_the_day (meeting_id, is_published);

CREATE INDEX IF NOT EXISTS idx_meeting_roles_meeting_booking
  ON public.app_meeting_roles_management (meeting_id, booking_status);

CREATE INDEX IF NOT EXISTS idx_club_profiles_club_id
  ON public.club_profiles (club_id);

ANALYZE public.grammarian_word_of_the_day;
ANALYZE public.grammarian_idiom_of_the_day;
ANALYZE public.grammarian_quote_of_the_day;
ANALYZE public.app_meeting_roles_management;
ANALYZE public.club_profiles;
