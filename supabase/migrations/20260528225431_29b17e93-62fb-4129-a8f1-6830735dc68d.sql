CREATE TABLE public.engineering_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  car_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'handling',
  title TEXT NOT NULL,
  detail TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  confidence INTEGER NOT NULL DEFAULT 3,
  occurrences INTEGER NOT NULL DEFAULT 1,
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  conditions TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  pinned BOOLEAN NOT NULL DEFAULT false,
  session_id UUID,
  setup_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.engineering_memory TO authenticated;
GRANT ALL ON public.engineering_memory TO service_role;

ALTER TABLE public.engineering_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view engineering_memory for accessible cars"
  ON public.engineering_memory FOR SELECT
  USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));

CREATE POLICY "insert engineering_memory on accessible cars"
  ON public.engineering_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "update engineering_memory on accessible cars"
  ON public.engineering_memory FOR UPDATE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "delete engineering_memory on accessible cars"
  ON public.engineering_memory FOR DELETE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE TRIGGER engineering_memory_set_updated_at
  BEFORE UPDATE ON public.engineering_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_engineering_memory_car ON public.engineering_memory(car_id, status, pinned DESC, last_observed_at DESC);