/*
  # Fix RLS recursion causing grammarian word/idiom/quote to return empty

  ## Problem
  The grammarian word/idiom/quote SELECT policies check:
    club_id IN (SELECT club_id FROM app_club_user_relationship WHERE user_id = auth.uid() AND is_authenticated = true)

  But app_club_user_relationship itself has a SELECT policy that calls get_user_club_ids(),
  which queries app_club_user_relationship again → infinite recursion → returns empty.

  ## Fix
  Replace the grammarian table RLS policies' subquery with the security-definer
  helper function get_user_club_ids() which bypasses RLS on app_club_user_relationship,
  breaking the recursion chain.
*/

-- Fix grammarian_word_of_the_day SELECT policies
DROP POLICY IF EXISTS "Club members can view any word of the day for their club" ON grammarian_word_of_the_day;
DROP POLICY IF EXISTS "Club members can view published word of the day" ON grammarian_word_of_the_day;

CREATE POLICY "Club members can view any word of the day for their club"
  ON grammarian_word_of_the_day
  FOR SELECT
  TO authenticated
  USING (club_id IN (SELECT get_user_club_ids()));

CREATE POLICY "Club members can view published word of the day"
  ON grammarian_word_of_the_day
  FOR SELECT
  TO authenticated
  USING (is_published = true AND club_id IN (SELECT get_user_club_ids()));

-- Fix grammarian_idiom_of_the_day SELECT policies
DROP POLICY IF EXISTS "Club members can view any idiom of the day for their club" ON grammarian_idiom_of_the_day;
DROP POLICY IF EXISTS "Club members can view published idiom of the day" ON grammarian_idiom_of_the_day;

CREATE POLICY "Club members can view any idiom of the day for their club"
  ON grammarian_idiom_of_the_day
  FOR SELECT
  TO authenticated
  USING (club_id IN (SELECT get_user_club_ids()));

CREATE POLICY "Club members can view published idiom of the day"
  ON grammarian_idiom_of_the_day
  FOR SELECT
  TO authenticated
  USING (is_published = true AND club_id IN (SELECT get_user_club_ids()));

-- Fix grammarian_quote_of_the_day SELECT policies
DROP POLICY IF EXISTS "Club members can view any quote of the day for their club" ON grammarian_quote_of_the_day;
DROP POLICY IF EXISTS "Club members can view published quote of the day" ON grammarian_quote_of_the_day;

CREATE POLICY "Club members can view any quote of the day for their club"
  ON grammarian_quote_of_the_day
  FOR SELECT
  TO authenticated
  USING (club_id IN (SELECT get_user_club_ids()));

CREATE POLICY "Club members can view published quote of the day"
  ON grammarian_quote_of_the_day
  FOR SELECT
  TO authenticated
  USING (is_published = true AND club_id IN (SELECT get_user_club_ids()));
