
CREATE TABLE public.driver_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  car_id UUID NOT NULL,
  session_id UUID,
  setup_id UUID,
  corner TEXT,
  category TEXT NOT NULL DEFAULT 'balance',
  phase TEXT,
  balance TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  confidence INTEGER,
  description TEXT NOT NULL,
  recommendation TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX driver_feedback_car_idx ON public.driver_feedback (car_id, recorded_at DESC);
CREATE INDEX driver_feedback_session_idx ON public.driver_feedback (session_id);
CREATE INDEX driver_feedback_setup_idx ON public.driver_feedback (setup_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_feedback TO authenticated;
GRANT ALL ON public.driver_feedback TO service_role;

ALTER TABLE public.driver_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view driver_feedback for accessible cars"
  ON public.driver_feedback FOR SELECT
  USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));

CREATE POLICY "insert driver_feedback on accessible cars"
  ON public.driver_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "update driver_feedback on accessible cars"
  ON public.driver_feedback FOR UPDATE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "delete driver_feedback on accessible cars"
  ON public.driver_feedback FOR DELETE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE TRIGGER trg_driver_feedback_updated_at
  BEFORE UPDATE ON public.driver_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
