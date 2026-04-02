-- Allow club VPE to INSERT/UPDATE/DELETE grammarian word/idiom/quote rows for their club,
-- same as assigned grammarian. Prep screens store rows under assigned grammarian's user id
-- while auth.uid() is often the VPE — previous RLS blocked those writes.
-- Also grant VPE full RLS access on app_grammarian_daily_elements when that table exists.

-- grammarian_word_of_the_day
DROP POLICY IF EXISTS "Grammarian can insert word of the day" ON public.grammarian_word_of_the_day;
CREATE POLICY "Grammarian can insert word of the day"
  ON public.grammarian_word_of_the_day
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id IN (SELECT public.get_user_club_ids())
    AND (
      grammarian_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.club_profiles cp
        WHERE cp.club_id = club_id
          AND cp.vpe_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Grammarian can update own word of the day" ON public.grammarian_word_of_the_day;
CREATE POLICY "Grammarian can update own word of the day"
  ON public.grammarian_word_of_the_day
  FOR UPDATE
  TO authenticated
  USING (
    grammarian_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = grammarian_word_of_the_day.club_id
        AND cp.vpe_id = auth.uid()
    )
  )
  WITH CHECK (
    grammarian_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = grammarian_word_of_the_day.club_id
        AND cp.vpe_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Grammarian can delete own word of the day" ON public.grammarian_word_of_the_day;
CREATE POLICY "Grammarian can delete own word of the day"
  ON public.grammarian_word_of_the_day
  FOR DELETE
  TO authenticated
  USING (
    grammarian_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = grammarian_word_of_the_day.club_id
        AND cp.vpe_id = auth.uid()
    )
  );

-- grammarian_idiom_of_the_day
DROP POLICY IF EXISTS "Grammarian can insert idiom of the day" ON public.grammarian_idiom_of_the_day;
CREATE POLICY "Grammarian can insert idiom of the day"
  ON public.grammarian_idiom_of_the_day
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id IN (SELECT public.get_user_club_ids())
    AND (
      grammarian_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.club_profiles cp
        WHERE cp.club_id = club_id
          AND cp.vpe_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Grammarian can update own idiom of the day" ON public.grammarian_idiom_of_the_day;
CREATE POLICY "Grammarian can update own idiom of the day"
  ON public.grammarian_idiom_of_the_day
  FOR UPDATE
  TO authenticated
  USING (
    grammarian_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = grammarian_idiom_of_the_day.club_id
        AND cp.vpe_id = auth.uid()
    )
  )
  WITH CHECK (
    grammarian_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = grammarian_idiom_of_the_day.club_id
        AND cp.vpe_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Grammarian can delete own idiom of the day" ON public.grammarian_idiom_of_the_day;
CREATE POLICY "Grammarian can delete own idiom of the day"
  ON public.grammarian_idiom_of_the_day
  FOR DELETE
  TO authenticated
  USING (
    grammarian_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = grammarian_idiom_of_the_day.club_id
        AND cp.vpe_id = auth.uid()
    )
  );

-- grammarian_quote_of_the_day
DROP POLICY IF EXISTS "Grammarian can insert quote of the day" ON public.grammarian_quote_of_the_day;
CREATE POLICY "Grammarian can insert quote of the day"
  ON public.grammarian_quote_of_the_day
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id IN (SELECT public.get_user_club_ids())
    AND (
      grammarian_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.club_profiles cp
        WHERE cp.club_id = club_id
          AND cp.vpe_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Grammarian can update own quote of the day" ON public.grammarian_quote_of_the_day;
CREATE POLICY "Grammarian can update own quote of the day"
  ON public.grammarian_quote_of_the_day
  FOR UPDATE
  TO authenticated
  USING (
    grammarian_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = grammarian_quote_of_the_day.club_id
        AND cp.vpe_id = auth.uid()
    )
  )
  WITH CHECK (
    grammarian_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = grammarian_quote_of_the_day.club_id
        AND cp.vpe_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Grammarian can delete own quote of the day" ON public.grammarian_quote_of_the_day;
CREATE POLICY "Grammarian can delete own quote of the day"
  ON public.grammarian_quote_of_the_day
  FOR DELETE
  TO authenticated
  USING (
    grammarian_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_profiles cp
      WHERE cp.club_id = grammarian_quote_of_the_day.club_id
        AND cp.vpe_id = auth.uid()
    )
  );

-- app_grammarian_daily_elements (table may exist without CREATE in this repo)
DO $body$
BEGIN
  IF to_regclass('public.app_grammarian_daily_elements') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Club VPE full access to grammarian daily elements" ON public.app_grammarian_daily_elements;
    CREATE POLICY "Club VPE full access to grammarian daily elements"
      ON public.app_grammarian_daily_elements
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.app_club_meeting m
          JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
          WHERE m.id = meeting_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.app_club_meeting m
          JOIN public.club_profiles cp ON cp.club_id = m.club_id AND cp.vpe_id = auth.uid()
          WHERE m.id = meeting_id
        )
      );
  END IF;
END
$body$;
