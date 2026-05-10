CREATE TABLE public.laps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  setup_id UUID NOT NULL REFERENCES public.setups(id) ON DELETE CASCADE,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  lap_number INTEGER,
  lap_time_ms INTEGER NOT NULL,
  sector_1_ms INTEGER,
  sector_2_ms INTEGER,
  sector_3_ms INTEGER,
  conditions TEXT,
  tire_set TEXT,
  fuel_load NUMERIC,
  notes TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_laps_setup ON public.laps(setup_id);
CREATE INDEX idx_laps_car ON public.laps(car_id);
CREATE INDEX idx_laps_user ON public.laps(user_id);

ALTER TABLE public.laps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own laps" ON public.laps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own laps" ON public.laps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own laps" ON public.laps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own laps" ON public.laps FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER laps_set_updated_at
BEFORE UPDATE ON public.laps
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();