CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'off' CHECK (mode IN ('off', 'beta', 'on')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Superusers can manage feature flags"
ON public.feature_flags
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superuser'))
WITH CHECK (public.has_role(auth.uid(), 'superuser'));

INSERT INTO public.feature_flags (key, mode) VALUES ('three_things', 'off')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.feature_enabled(flag_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE f.mode
      WHEN 'on' THEN true
      WHEN 'beta' THEN EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = auth.uid() AND r.role IN ('beta_user', 'superuser')
      )
      ELSE false
    END
    FROM public.feature_flags f
    WHERE f.key = flag_key
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.feature_enabled_for(flag_key text, uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE f.mode
      WHEN 'on' THEN true
      WHEN 'beta' THEN EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = uid AND r.role IN ('beta_user', 'superuser')
      )
      ELSE false
    END
    FROM public.feature_flags f
    WHERE f.key = flag_key
  ), false);
$$;

REVOKE EXECUTE ON FUNCTION public.feature_enabled(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feature_enabled(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.feature_enabled_for(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feature_enabled_for(text, uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  category text NOT NULL CHECK (category IN ('closeness', 'makes_it_happen', 'wishes', 'reflection')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prompt_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES public.prompts(id),
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (couple_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.prompt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.prompt_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  partner_notified_at timestamptz,
  UNIQUE (round_id, user_id)
);

CREATE INDEX IF NOT EXISTS prompt_rounds_couple_idx ON public.prompt_rounds (couple_id, week_start DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
GRANT SELECT ON public.prompts TO authenticated;
GRANT ALL ON public.prompts TO service_role;
GRANT SELECT ON public.prompt_rounds TO authenticated;
GRANT ALL ON public.prompt_rounds TO service_role;
GRANT SELECT, DELETE ON public.prompt_answers TO authenticated;
GRANT ALL ON public.prompt_answers TO service_role;

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_answers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.my_couple_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM public.couples c
  WHERE c.user1_id = auth.uid() OR c.user2_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.round_is_mine(p_round_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prompt_rounds r
    WHERE r.id = p_round_id AND r.couple_id = public.my_couple_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.i_have_answered(p_round_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prompt_answers a
    WHERE a.round_id = p_round_id AND a.user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.my_couple_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.round_is_mine(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.i_have_answered(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_couple_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.round_is_mine(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.i_have_answered(uuid) TO authenticated;

CREATE POLICY "Prompts readable when the feature is enabled"
ON public.prompts
FOR SELECT
TO authenticated
USING (public.feature_enabled('three_things') AND active);

CREATE POLICY "Couples read their own rounds"
ON public.prompt_rounds
FOR SELECT
TO authenticated
USING (public.feature_enabled('three_things') AND couple_id = public.my_couple_id());

CREATE POLICY "Read own answers, and partner answers after both have answered"
ON public.prompt_answers
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.feature_enabled('three_things')
    AND public.round_is_mine(round_id)
    AND public.i_have_answered(round_id)
  )
);

CREATE POLICY "Delete own answers"
ON public.prompt_answers
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.couple_week_start(p_couple_id uuid)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz text;
  result date;
BEGIN
  SELECT p.timezone INTO tz
  FROM public.couples c
  JOIN public.profiles p ON p.user_id = c.user1_id
  WHERE c.id = p_couple_id;

  BEGIN
    result := date_trunc('week', now() AT TIME ZONE COALESCE(tz, 'Europe/Stockholm'))::date;
  EXCEPTION WHEN OTHERS THEN
    result := date_trunc('week', now() AT TIME ZONE 'Europe/Stockholm')::date;
  END;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.couple_week_start(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.question_state()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  wk date;
  n_prompts integer;
  n_rounds integer;
  pick uuid;
  rnd public.prompt_rounds%ROWTYPE;
  prm public.prompts%ROWTYPE;
  mine jsonb;
  theirs jsonb;
  partner uuid;
  partner_name text;
BEGIN
  IF uid IS NULL OR NOT public.feature_enabled('three_things') THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  SELECT c.id,
         CASE WHEN c.user1_id = uid THEN c.user2_id ELSE c.user1_id END
    INTO cid, partner
  FROM public.couples c
  WHERE c.user1_id = uid OR c.user2_id = uid
  LIMIT 1;

  IF cid IS NULL THEN
    RETURN jsonb_build_object('enabled', true, 'has_couple', false);
  END IF;

  wk := public.couple_week_start(cid);

  SELECT * INTO rnd FROM public.prompt_rounds WHERE couple_id = cid AND week_start = wk;

  IF NOT FOUND THEN
    SELECT count(*) INTO n_prompts FROM public.prompts WHERE active;
    IF n_prompts = 0 THEN
      RETURN jsonb_build_object('enabled', true, 'has_couple', true, 'round_id', null);
    END IF;
    SELECT count(*) INTO n_rounds FROM public.prompt_rounds WHERE couple_id = cid;
    SELECT id INTO pick
    FROM public.prompts
    WHERE active
    ORDER BY sort_order
    OFFSET (n_rounds % n_prompts) LIMIT 1;

    INSERT INTO public.prompt_rounds (couple_id, prompt_id, week_start)
    VALUES (cid, pick, wk)
    ON CONFLICT (couple_id, week_start) DO NOTHING;

    SELECT * INTO rnd FROM public.prompt_rounds WHERE couple_id = cid AND week_start = wk;
  END IF;

  SELECT * INTO prm FROM public.prompts WHERE id = rnd.prompt_id;
  SELECT a.answers INTO mine FROM public.prompt_answers a WHERE a.round_id = rnd.id AND a.user_id = uid;
  SELECT a.answers INTO theirs FROM public.prompt_answers a WHERE a.round_id = rnd.id AND a.user_id = partner;
  SELECT p.name INTO partner_name FROM public.profiles p WHERE p.user_id = partner;

  RETURN jsonb_build_object(
    'enabled', true,
    'has_couple', true,
    'round_id', rnd.id,
    'week_start', rnd.week_start,
    'prompt', jsonb_build_object('id', prm.id, 'text', prm.text, 'category', prm.category),
    'my_answers', mine,
    'partner_answered', theirs IS NOT NULL,
    'revealed', mine IS NOT NULL AND theirs IS NOT NULL,
    'partner_answers', CASE WHEN mine IS NOT NULL THEN theirs ELSE NULL END,
    'partner_name', partner_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_answers(p_round_id uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  partner uuid;
  rnd public.prompt_rounds%ROWTYPE;
  cleaned jsonb;
  existing_id uuid;
  partner_has boolean;
  was_inserted boolean;
BEGIN
  IF uid IS NULL OR NOT public.feature_enabled('three_things') THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE = '42501';
  END IF;

  SELECT c.id,
         CASE WHEN c.user1_id = uid THEN c.user2_id ELSE c.user1_id END
    INTO cid, partner
  FROM public.couples c
  WHERE c.user1_id = uid OR c.user2_id = uid
  LIMIT 1;

  IF cid IS NULL THEN
    RAISE EXCEPTION 'no_couple' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO rnd FROM public.prompt_rounds WHERE id = p_round_id AND couple_id = cid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'round_not_found' USING ERRCODE = '42501';
  END IF;

  IF rnd.week_start <> public.couple_week_start(cid) THEN
    RAISE EXCEPTION 'round_closed' USING ERRCODE = '42501';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t.v)), '[]'::jsonb) INTO cleaned
  FROM (
    SELECT btrim(e) AS v
    FROM jsonb_array_elements_text(p_answers) WITH ORDINALITY AS x(e, ord)
    WHERE btrim(e) <> ''
    ORDER BY ord
  ) t;

  IF jsonb_array_length(cleaned) < 1 OR jsonb_array_length(cleaned) > 3 THEN
    RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(cleaned) e WHERE char_length(e) > 140) THEN
    RAISE EXCEPTION 'answer_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT a.id INTO existing_id FROM public.prompt_answers a WHERE a.round_id = rnd.id AND a.user_id = uid;
  SELECT EXISTS (
    SELECT 1 FROM public.prompt_answers a WHERE a.round_id = rnd.id AND a.user_id = partner
  ) INTO partner_has;

  IF existing_id IS NOT NULL AND partner_has THEN
    RAISE EXCEPTION 'already_revealed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.prompt_answers (round_id, user_id, answers)
  VALUES (rnd.id, uid, cleaned)
  ON CONFLICT (round_id, user_id)
  DO UPDATE SET answers = EXCLUDED.answers, updated_at = now()
  RETURNING (xmax = 0) INTO was_inserted;

  RETURN jsonb_build_object(
    'ok', true,
    'first_submit', was_inserted,
    'revealed', partner_has
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.question_state() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_answers(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.question_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_answers(uuid, jsonb) TO authenticated;

INSERT INTO public.prompts (sort_order, category, text) VALUES
  (1,  'closeness',       'What are 3 things you appreciate about us right now?'),
  (2,  'reflection',      'What are 3 things that made last week good for us?'),
  (3,  'makes_it_happen', 'What are 3 things that make it happen for you?'),
  (4,  'wishes',          'What are 3 things you''d like more of?'),
  (5,  'closeness',       'What are 3 moments lately when you felt closest to me?'),
  (6,  'reflection',      'What are 3 things that made you smile this week?'),
  (7,  'makes_it_happen', 'What are 3 things that help you get in the mood?'),
  (8,  'wishes',          'What are 3 things you''d love for us to make time for?'),
  (9,  'closeness',       'What are 3 things that make you feel close to me outside the bedroom?'),
  (10, 'reflection',      'What gets in the way when we''re busy? Name 3 things.'),
  (11, 'makes_it_happen', 'What are 3 things that make a spontaneous moment more likely?'),
  (12, 'wishes',          'What are 3 things you''d like us to try together, big or small?'),
  (13, 'closeness',       'What are 3 small things I do that make you feel loved?'),
  (14, 'reflection',      'What are 3 things we do well as a couple?'),
  (15, 'makes_it_happen', 'What are 3 things that make it easier to start?'),
  (16, 'wishes',          'What are 3 ways I could surprise you?'),
  (17, 'closeness',       'What are 3 things that help you feel relaxed around me?'),
  (18, 'reflection',      'What are 3 things that would make next week easier for you?'),
  (19, 'makes_it_happen', 'What are 3 moments of the day when you feel most open to connecting?'),
  (20, 'wishes',          'What are 3 things you wish we talked about more?'),
  (21, 'closeness',       'What are 3 things you''d like us to do together this week, without planning anything big?'),
  (22, 'reflection',      'What are 3 things you''re proud of us for?'),
  (23, 'makes_it_happen', 'What are 3 small things I do that you''d like more of?'),
  (24, 'wishes',          'What are 3 things you''d like us to do more often, just the two of us?')
ON CONFLICT (sort_order) DO NOTHING;