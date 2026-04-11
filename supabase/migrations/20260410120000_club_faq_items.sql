/*
  # Club FAQ items per club

  - `club_faq_items`: editable Q&A per club (default seed for new clubs + backfill for existing).
  - `default_club_faq_seed_json()`: immutable JSON of 50 default entries (40 general + ExCom).
  - `seed_default_club_faq(uuid)`: inserts defaults if club has no rows (SECURITY DEFINER).
  - Triggers: after INSERT on clubs (active), after club activation (active false→true).
  - RLS: members read; excomm/club_leader write.
*/

CREATE TABLE public.club_faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_faq_items_club_sort_unique UNIQUE (club_id, sort_order)
);

CREATE INDEX idx_club_faq_items_club_id ON public.club_faq_items (club_id);

CREATE OR REPLACE FUNCTION public.update_club_faq_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $tr$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$tr$;

DROP TRIGGER IF EXISTS trigger_update_club_faq_items_updated_at ON public.club_faq_items;
CREATE TRIGGER trigger_update_club_faq_items_updated_at
  BEFORE UPDATE ON public.club_faq_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_club_faq_items_updated_at();

CREATE OR REPLACE FUNCTION public.default_club_faq_seed_json()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT $seed$[{"sort_order":1,"question":"What is Toastmasters?","answer":"A global program by Toastmasters International that helps people improve communication and leadership through practice."},{"sort_order":2,"question":"What happens in a meeting?","answer":"Meetings include prepared speeches, impromptu speaking, and feedback sessions in a structured format."},{"sort_order":3,"question":"Do I have to speak as a guest?","answer":"No, you can simply observe and participate only if you're comfortable."},{"sort_order":4,"question":"How will it help me?","answer":"It builds confidence, clarity, and improves speaking, listening, and leadership skills."},{"sort_order":5,"question":"What is Pathways?","answer":"A structured learning program with different tracks to develop communication and leadership step-by-step."},{"sort_order":6,"question":"How do I get feedback?","answer":"You receive constructive and encouraging feedback after every speech."},{"sort_order":7,"question":"How often are meetings?","answer":"Most clubs meet weekly or bi-weekly for 1–2 hours."},{"sort_order":8,"question":"How much does it cost?","answer":"There is a one-time joining fee and a small renewal fee every 6 months."},{"sort_order":9,"question":"Who can join?","answer":"Anyone above 18 years—students, professionals, or homemakers."},{"sort_order":10,"question":"Does it help in career growth?","answer":"Yes, it improves presentation, leadership, and confidence for professional success."},{"sort_order":11,"question":"How does Toastmasters improve confidence?","answer":"Regular speaking practice reduces fear and builds self-assurance over time."},{"sort_order":12,"question":"How will it improve my communication skills?","answer":"You learn to organize thoughts and deliver clear, impactful messages."},{"sort_order":13,"question":"Can it help with leadership skills?","answer":"Yes, by taking meeting roles and responsibilities, you develop leadership abilities."},{"sort_order":14,"question":"Will it help in my career?","answer":"Strong communication and leadership skills enhance career opportunities."},{"sort_order":15,"question":"What makes Toastmasters different from other courses?","answer":"It's a practical, learn-by-doing environment with real-time feedback."},{"sort_order":16,"question":"How established is Toastmasters?","answer":"Founded in 1924, it has helped millions worldwide."},{"sort_order":17,"question":"Is Toastmasters a global organization?","answer":"Yes, it operates in 140+ countries with thousands of clubs."},{"sort_order":18,"question":"Is the learning program structured?","answer":"Yes, the Pathways program provides clear, step-by-step development."},{"sort_order":19,"question":"Do professionals benefit from Toastmasters?","answer":"Yes, many leaders and entrepreneurs use it to refine their skills."},{"sort_order":20,"question":"Is Toastmasters recognized and trusted?","answer":"It is widely respected for its practical and effective learning approach."},{"sort_order":21,"question":"Will I get a mentor in Toastmasters?","answer":"Yes, new members are guided by experienced mentors."},{"sort_order":22,"question":"How does feedback work?","answer":"Feedback is structured, positive, and focused on improvement."},{"sort_order":23,"question":"Is the environment supportive for beginners?","answer":"Yes, it is friendly, encouraging, and non-judgmental."},{"sort_order":24,"question":"What is a Prepared Speech?","answer":"A planned speech delivered by a member to practice a specific skill, usually 5–7 minutes long."},{"sort_order":25,"question":"What does the Speaker do?","answer":"Delivers a prepared speech focusing on a specific skill."},{"sort_order":26,"question":"What does the Evaluator do?","answer":"Provides feedback highlighting strengths and improvement areas."},{"sort_order":27,"question":"What is the role of the Table Topics Master?","answer":"Conducts the impromptu speaking session with questions."},{"sort_order":28,"question":"What does a Table Topics Speaker do?","answer":"Speaks on the spot for 1–2 minutes on a given topic."},{"sort_order":29,"question":"What does the General Evaluator do?","answer":"Evaluates the overall meeting and provides suggestions."},{"sort_order":30,"question":"What is the Timer's role?","answer":"Tracks speaking time and signals using colors."},{"sort_order":31,"question":"What does the Ah-Counter do?","answer":"Tracks filler words to improve speech clarity."},{"sort_order":32,"question":"What is the Grammarian's role?","answer":"Observes language use and introduces a \"Word of the Day.\""},{"sort_order":33,"question":"What does the Toastmaster of the Day (TMOD) do?","answer":"Hosts the meeting and ensures smooth flow."},{"sort_order":34,"question":"What is Table Topics and why is it important?","answer":"It helps improve quick thinking and impromptu speaking skills."},{"sort_order":35,"question":"Can I attend multiple meetings as a guest before joining?","answer":"Yes, you can visit a few meetings before deciding to join."},{"sort_order":36,"question":"How long does it take to see improvement in speaking skills?","answer":"Most people notice improvement within a few weeks of regular participation."},{"sort_order":37,"question":"Will I get opportunities to speak regularly?","answer":"Yes, members get frequent chances to speak and take roles."},{"sort_order":38,"question":"How are meetings structured and timed?","answer":"Meetings follow a fixed agenda with time-managed segments."},{"sort_order":39,"question":"Can introverts benefit from Toastmasters?","answer":"Absolutely, it provides a safe space to build confidence gradually."},{"sort_order":40,"question":"What kind of topics can I speak about in my speeches?","answer":"You can choose any topic—personal, professional, or creative."},{"sort_order":41,"question":"What is ExCom?","answer":"The leadership team that runs the club. They ensure smooth meetings and member growth."},{"sort_order":42,"question":"Role of the President?","answer":"Leads the club and sets direction. Ensures a positive and successful environment."},{"sort_order":43,"question":"Role of VPE?","answer":"Plans meetings and tracks member progress. Ensures quality learning and speeches."},{"sort_order":44,"question":"Role of VPM?","answer":"Handles member growth and retention. Welcomes guests and supports onboarding."},{"sort_order":45,"question":"Role of VPPR?","answer":"Manages promotions and public image. Attracts guests through outreach."},{"sort_order":46,"question":"Role of the Secretary?","answer":"Maintains records and meeting notes. Ensures proper communication."},{"sort_order":47,"question":"Role of the Treasurer?","answer":"Manages finances and fee collection. Ensures transparency and payments."},{"sort_order":48,"question":"Role of SAA?","answer":"Handles meeting setup and logistics. Keeps sessions running smoothly."},{"sort_order":49,"question":"How does ExCom help members?","answer":"Provides roles, mentoring, and guidance. Supports growth and goal achievement."},{"sort_order":50,"question":"How often does ExCom meet?","answer":"Meets regularly to review progress. Plans improvements and club activities."}]$seed$::jsonb;
$fn$;

CREATE OR REPLACE FUNCTION public.seed_default_club_faq(p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sf$
BEGIN
  IF EXISTS (SELECT 1 FROM public.club_faq_items WHERE club_id = p_club_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO public.club_faq_items (club_id, sort_order, question, answer, created_at, updated_at)
  SELECT
    p_club_id,
    (e->>'sort_order')::integer,
    e->>'question',
    e->>'answer',
    now(),
    now()
  FROM jsonb_array_elements(public.default_club_faq_seed_json()) AS e;
END;
$sf$;

CREATE OR REPLACE FUNCTION public.trg_seed_club_faq_after_club_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ti$
BEGIN
  IF NEW.active = true THEN
    PERFORM public.seed_default_club_faq(NEW.id);
  END IF;
  RETURN NEW;
END;
$ti$;

DROP TRIGGER IF EXISTS trigger_seed_club_faq_after_club_insert ON public.clubs;
CREATE TRIGGER trigger_seed_club_faq_after_club_insert
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_club_faq_after_club_insert();

CREATE OR REPLACE FUNCTION public.trg_seed_club_faq_on_club_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ta$
BEGIN
  IF OLD.active = false AND NEW.active = true THEN
    PERFORM public.seed_default_club_faq(NEW.id);
  END IF;
  RETURN NEW;
END;
$ta$;

DROP TRIGGER IF EXISTS trigger_seed_club_faq_on_club_activation ON public.clubs;
CREATE TRIGGER trigger_seed_club_faq_on_club_activation
  AFTER UPDATE OF active ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_club_faq_on_club_activation();

ALTER TABLE public.club_faq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can read club FAQ items"
  ON public.club_faq_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = club_faq_items.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Excomm can insert club FAQ items"
  ON public.club_faq_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = club_faq_items.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can update club FAQ items"
  ON public.club_faq_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = club_faq_items.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = club_faq_items.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can delete club FAQ items"
  ON public.club_faq_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = club_faq_items.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

INSERT INTO public.club_faq_items (club_id, sort_order, question, answer, created_at, updated_at)
SELECT c.id, s.sort_order, s.question, s.answer, now(), now()
FROM public.clubs c
CROSS JOIN LATERAL (
  SELECT
    (e->>'sort_order')::integer AS sort_order,
    e->>'question' AS question,
    e->>'answer' AS answer
  FROM jsonb_array_elements(public.default_club_faq_seed_json()) AS e
) AS s
WHERE c.active = true
  AND NOT EXISTS (SELECT 1 FROM public.club_faq_items f WHERE f.club_id = c.id);

COMMENT ON TABLE public.club_faq_items IS 'Per-club FAQ; seeded on club create with defaults; ExComm may edit.';

-- Callable by ExComm if a club somehow has no rows yet (e.g. before triggers existed).
CREATE OR REPLACE FUNCTION public.ensure_club_faq_defaults_for_my_club(p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ef$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_club_user_relationship r
    WHERE r.club_id = p_club_id
      AND r.user_id = auth.uid()
      AND r.is_authenticated = true
      AND r.role IN ('excomm', 'club_leader')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  PERFORM public.seed_default_club_faq(p_club_id);
END;
$ef$;

REVOKE ALL ON FUNCTION public.default_club_faq_seed_json() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_default_club_faq(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_seed_club_faq_after_club_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_seed_club_faq_on_club_activation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_club_faq_defaults_for_my_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_club_faq_defaults_for_my_club(uuid) TO authenticated;
