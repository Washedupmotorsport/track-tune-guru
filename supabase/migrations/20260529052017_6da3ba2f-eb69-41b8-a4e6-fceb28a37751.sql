
ALTER TABLE public.driver_notes
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS corner text,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'handling';

CREATE INDEX IF NOT EXISTS idx_driver_notes_session ON public.driver_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_driver_notes_setup ON public.driver_notes(setup_id);
CREATE INDEX IF NOT EXISTS idx_driver_notes_car_created ON public.driver_notes(car_id, created_at DESC);
