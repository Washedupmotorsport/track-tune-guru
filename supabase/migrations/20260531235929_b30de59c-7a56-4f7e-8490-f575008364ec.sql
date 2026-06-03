CREATE TABLE public.known_behaviours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  car_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'handling',
  severity text NOT NULL DEFAULT 'info',
  triggers text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  track text,
  compound text,
  weather text,
  fuel_state text,
  temp_min_c numeric,
  temp_max_c numeric,
  setup_id uuid,
  status text NOT NULL DEFAULT 'active',
  pinned boolean NOT NULL DEFAULT false,
  occurrences integer NOT NULL DEFAULT 1,
  confidence integer NOT NULL DEFAULT 3,
  workaround text,
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.known_behaviours TO authenticated;
GRANT ALL ON public.known_behaviours TO service_role;

ALTER TABLE public.known_behaviours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view known_behaviours for accessible cars"
  ON public.known_behaviours FOR SELECT
  USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));

CREATE POLICY "insert known_behaviours on accessible cars"
  ON public.known_behaviours FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "update known_behaviours on accessible cars"
  ON public.known_behaviours FOR UPDATE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "delete known_behaviours on accessible cars"
  ON public.known_behaviours FOR DELETE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE TRIGGER set_known_behaviours_updated_at
  BEFORE UPDATE ON public.known_behaviours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX known_behaviours_car_idx ON public.known_behaviours(car_id, last_observed_at DESC);