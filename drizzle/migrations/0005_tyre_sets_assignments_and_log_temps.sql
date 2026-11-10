CREATE TABLE public.tyre_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  name text NOT NULL,
  manufacturer text,
  model text,
  compound text,
  size text,
  serial_no text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tyre_sets TO authenticated;
GRANT ALL ON public.tyre_sets TO service_role;
ALTER TABLE public.tyre_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tyre sets" ON public.tyre_sets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tyre sets" ON public.tyre_sets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tyre sets" ON public.tyre_sets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tyre sets" ON public.tyre_sets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.tyre_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  tyre_set_id uuid NOT NULL REFERENCES public.tyre_sets(id) ON DELETE CASCADE,
  tyre_slot integer NOT NULL DEFAULT 1,
  position text NOT NULL CHECK (position IN ('fl','fr','rl','rr')),
  fitted_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tyre_assignments TO authenticated;
GRANT ALL ON public.tyre_assignments TO service_role;
ALTER TABLE public.tyre_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tyre assignments" ON public.tyre_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tyre assignments" ON public.tyre_assignments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tyre assignments" ON public.tyre_assignments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tyre assignments" ON public.tyre_assignments FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.tire_logs
  ADD COLUMN tyre_set_id uuid REFERENCES public.tyre_sets(id) ON DELETE SET NULL,
  ADD COLUMN laps integer,
  ADD COLUMN distance_km numeric,
  ADD COLUMN temp_fl_inner numeric,
  ADD COLUMN temp_fl_mid numeric,
  ADD COLUMN temp_fl_outer numeric,
  ADD COLUMN temp_fr_inner numeric,
  ADD COLUMN temp_fr_mid numeric,
  ADD COLUMN temp_fr_outer numeric,
  ADD COLUMN temp_rl_inner numeric,
  ADD COLUMN temp_rl_mid numeric,
  ADD COLUMN temp_rl_outer numeric,
  ADD COLUMN temp_rr_inner numeric,
  ADD COLUMN temp_rr_mid numeric,
  ADD COLUMN temp_rr_outer numeric;

ALTER TABLE public.tire_stints
  ADD COLUMN tyre_set_id uuid REFERENCES public.tyre_sets(id) ON DELETE SET NULL;