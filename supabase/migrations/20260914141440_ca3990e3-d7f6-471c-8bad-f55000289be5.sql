ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS life_objective TEXT,
  ADD COLUMN IF NOT EXISTS passion TEXT;

CREATE TABLE IF NOT EXISTS public.routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  roadmap JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  encouragement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routines TO authenticated;
GRANT ALL ON public.routines TO service_role;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own routine" ON public.routines FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.routine_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  emotion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS routine_messages_user_created_idx ON public.routine_messages (user_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_messages TO authenticated;
GRANT ALL ON public.routine_messages TO service_role;
ALTER TABLE public.routine_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own routine messages" ON public.routine_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.motivations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  quote TEXT NOT NULL,
  author TEXT,
  image_index SMALLINT NOT NULL DEFAULT 0,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS motivations_user_shown_idx ON public.motivations (user_id, shown_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivations TO authenticated;
GRANT ALL ON public.motivations TO service_role;
ALTER TABLE public.motivations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own motivations" ON public.motivations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);