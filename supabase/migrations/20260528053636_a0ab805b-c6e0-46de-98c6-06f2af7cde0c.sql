
CREATE TABLE public.damage_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  car_id UUID NOT NULL,
  session_id UUID,
  event_id UUID,
  component TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'minor',
  status TEXT NOT NULL DEFAULT 'open',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  repair_cost NUMERIC,
  parts_used TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.damage_reports TO authenticated;
GRANT ALL ON public.damage_reports TO service_role;

ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view damage for accessible cars" ON public.damage_reports
  FOR SELECT USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));
CREATE POLICY "insert damage" ON public.damage_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "update damage" ON public.damage_reports
  FOR UPDATE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "delete damage" ON public.damage_reports
  FOR DELETE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE TRIGGER set_updated_at_damage_reports
  BEFORE UPDATE ON public.damage_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.maintenance_items
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
