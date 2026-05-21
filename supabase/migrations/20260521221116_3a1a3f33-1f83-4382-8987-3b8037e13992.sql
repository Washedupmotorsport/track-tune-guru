CREATE TABLE public.driver_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  car_id uuid REFERENCES public.cars(id) ON DELETE CASCADE,
  setup_id uuid REFERENCES public.setups(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  tags text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_notes_user ON public.driver_notes(user_id, created_at DESC);
CREATE INDEX idx_driver_notes_car ON public.driver_notes(car_id) WHERE car_id IS NOT NULL;
CREATE INDEX idx_driver_notes_setup ON public.driver_notes(setup_id) WHERE setup_id IS NOT NULL;

ALTER TABLE public.driver_notes ENABLE ROW LEVEL SECURITY;

-- Standalone notes (car_id IS NULL): only the author may view/edit.
-- Notes attached to a car: anyone with at least viewer access to the car may view; editors may write.
CREATE POLICY "view own or accessible-car notes"
ON public.driver_notes FOR SELECT
USING (
  auth.uid() = user_id
  OR (car_id IS NOT NULL AND public.has_car_access(car_id, auth.uid(), 'viewer'::share_role))
);

CREATE POLICY "insert own notes"
ON public.driver_notes FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    car_id IS NULL
    OR public.has_car_access(car_id, auth.uid(), 'editor'::share_role)
  )
);

CREATE POLICY "update own notes"
ON public.driver_notes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "delete own notes"
ON public.driver_notes FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER trg_driver_notes_updated
BEFORE UPDATE ON public.driver_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();