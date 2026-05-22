
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  car_id uuid NOT NULL,
  session_id uuid,
  lap_id uuid,
  flag text NOT NULL DEFAULT 'yellow',
  lap_number integer,
  description text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view incidents for accessible cars" ON public.incidents
  FOR SELECT USING (public.has_car_access(car_id, auth.uid(), 'viewer'));
CREATE POLICY "insert incidents" ON public.incidents
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_car_access(car_id, auth.uid(), 'editor'));
CREATE POLICY "update incidents" ON public.incidents
  FOR UPDATE USING (public.has_car_access(car_id, auth.uid(), 'editor'));
CREATE POLICY "delete incidents" ON public.incidents
  FOR DELETE USING (public.has_car_access(car_id, auth.uid(), 'editor'));

CREATE INDEX idx_incidents_session ON public.incidents(session_id);
CREATE INDEX idx_incidents_car ON public.incidents(car_id);
