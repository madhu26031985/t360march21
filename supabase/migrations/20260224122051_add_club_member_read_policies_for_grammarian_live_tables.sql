/*
  # Add club member read policies for grammarian live tables

  ## Problem
  The Grammarian Report (excomm view) shows incorrect counts because:
  1. grammarian_live_good_usage - only the grammarian themselves can read, no club member policy
  2. grammarian_live_improvements - same issue
  3. grammarian_word_of_the_day/quote/idiom - club members can only read PUBLISHED entries,
     but excomm report needs to know if ANY entry exists (published or not)

  ## Changes
  1. Add SELECT policy on grammarian_live_good_usage for club members
  2. Add SELECT policy on grammarian_live_improvements for club members
  3. Add SELECT policy on grammarian_word_of_the_day for club members (all entries, not just published)
  4. Add SELECT policy on grammarian_quote_of_the_day for club members (all entries)
  5. Add SELECT policy on grammarian_idiom_of_the_day for club members (all entries)
*/

CREATE POLICY "Club members can view live good usage for their club"
  ON grammarian_live_good_usage
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "Club members can view live improvements for their club"
  ON grammarian_live_improvements
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "Club members can view any word of the day for their club"
  ON grammarian_word_of_the_day
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "Club members can view any quote of the day for their club"
  ON grammarian_quote_of_the_day
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );

CREATE POLICY "Club members can view any idiom of the day for their club"
  ON grammarian_idiom_of_the_day
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM app_club_user_relationship
      WHERE user_id = auth.uid() AND is_authenticated = true
    )
  );
