ALTER TABLE public.setups
  ADD COLUMN IF NOT EXISTS preset_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ideal_conditions text,
  ADD COLUMN IF NOT EXISTS is_baseline boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_setups_preset_type ON public.setups(car_id, preset_type);