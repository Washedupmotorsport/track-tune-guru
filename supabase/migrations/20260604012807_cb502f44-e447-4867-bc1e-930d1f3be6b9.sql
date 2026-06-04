CREATE TABLE public.tutorial_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tour_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own tutorial progress" ON public.tutorial_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own tutorial progress" ON public.tutorial_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own tutorial progress" ON public.tutorial_progress
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own tutorial progress" ON public.tutorial_progress
  FOR DELETE USING (auth.uid() = user_id);