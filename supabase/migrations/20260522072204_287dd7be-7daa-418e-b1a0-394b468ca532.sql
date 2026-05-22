CREATE TABLE public.tire_stints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  car_id UUID NOT NULL,
  session_id UUID,
  tire_set TEXT NOT NULL,
  compound TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  laps INTEGER NOT NULL DEFAULT 0,
  distance_km NUMERIC,
  tread_fl NUMERIC,
  tread_fr NUMERIC,
  tread_rl NUMERIC,
  tread_rr NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tire_stints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view tire_stints for accessible cars"
  ON public.tire_stints FOR SELECT
  USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));

CREATE POLICY "edit tire_stints on accessible cars (insert)"
  ON public.tire_stints FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "edit tire_stints on accessible cars (update)"
  ON public.tire_stints FOR UPDATE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "edit tire_stints on accessible cars (delete)"
  ON public.tire_stints FOR DELETE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE TRIGGER tire_stints_set_updated_at
  BEFORE UPDATE ON public.tire_stints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_tire_stints_user_car ON public.tire_stints(user_id, car_id, tire_set, recorded_at DESC);