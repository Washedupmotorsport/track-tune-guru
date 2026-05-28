
CREATE TABLE public.setup_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  car_id UUID NOT NULL,
  setup_id UUID NOT NULL,
  parent_setup_id UUID,
  session_id UUID,
  -- engineering intent
  area TEXT NOT NULL DEFAULT 'balance', -- balance|tyre|brake|aero|damper|spring|geometry|diff|other
  summary TEXT NOT NULL,
  reason TEXT,
  expected_effect TEXT,
  -- what changed (key -> {from, to})
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- measured outcome (filled in after running)
  outcome_status TEXT NOT NULL DEFAULT 'pending', -- pending|confirmed|partial|rejected
  outcome_notes TEXT,
  lap_delta_ms INTEGER,
  confidence_delta INTEGER,
  measured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX setup_changes_setup_idx ON public.setup_changes(setup_id, created_at DESC);
CREATE INDEX setup_changes_car_idx ON public.setup_changes(car_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.setup_changes TO authenticated;
GRANT ALL ON public.setup_changes TO service_role;

ALTER TABLE public.setup_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view setup_changes for accessible cars"
ON public.setup_changes FOR SELECT
USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));

CREATE POLICY "insert setup_changes on accessible cars"
ON public.setup_changes FOR INSERT
WITH CHECK ((auth.uid() = user_id) AND has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "update setup_changes on accessible cars"
ON public.setup_changes FOR UPDATE
USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "delete setup_changes on accessible cars"
ON public.setup_changes FOR DELETE
USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE TRIGGER setup_changes_set_updated_at
BEFORE UPDATE ON public.setup_changes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
