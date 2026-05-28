
CREATE TABLE public.driver_confidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  car_id uuid NOT NULL,
  session_id uuid,
  setup_id uuid,
  overall integer NOT NULL CHECK (overall BETWEEN 1 AND 10),
  front integer CHECK (front BETWEEN 1 AND 10),
  rear integer CHECK (rear BETWEEN 1 AND 10),
  brakes integer CHECK (brakes BETWEEN 1 AND 10),
  traction integer CHECK (traction BETWEEN 1 AND 10),
  weather text,
  air_temp_c numeric,
  track_temp_c numeric,
  hot_fl numeric, hot_fr numeric, hot_rl numeric, hot_rr numeric,
  best_lap_ms integer,
  notes text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_confidence TO authenticated;
GRANT ALL ON public.driver_confidence TO service_role;

ALTER TABLE public.driver_confidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view confidence for accessible cars" ON public.driver_confidence
  FOR SELECT USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));
CREATE POLICY "insert confidence on accessible cars" ON public.driver_confidence
  FOR INSERT WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "update confidence on accessible cars" ON public.driver_confidence
  FOR UPDATE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "delete confidence on accessible cars" ON public.driver_confidence
  FOR DELETE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE TRIGGER set_driver_confidence_updated_at
  BEFORE UPDATE ON public.driver_confidence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_driver_confidence_car ON public.driver_confidence(car_id, recorded_at DESC);
CREATE INDEX idx_driver_confidence_session ON public.driver_confidence(session_id);
