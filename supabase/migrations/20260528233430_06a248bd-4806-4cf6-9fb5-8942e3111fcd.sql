CREATE TABLE public.session_debriefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  car_id uuid NOT NULL,
  session_id uuid,
  setup_id uuid,
  improved text,
  worsened text,
  needs_work text,
  confidence_issue text,
  tyre_issue text,
  balance_issue text,
  suggested_changes text,
  notes text,
  ai_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_debriefs TO authenticated;
GRANT ALL ON public.session_debriefs TO service_role;

ALTER TABLE public.session_debriefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view session_debriefs for accessible cars"
  ON public.session_debriefs FOR SELECT
  USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));

CREATE POLICY "insert session_debriefs on accessible cars"
  ON public.session_debriefs FOR INSERT
  WITH CHECK ((auth.uid() = user_id) AND has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "update session_debriefs on accessible cars"
  ON public.session_debriefs FOR UPDATE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "delete session_debriefs on accessible cars"
  ON public.session_debriefs FOR DELETE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE INDEX idx_session_debriefs_car ON public.session_debriefs(car_id, created_at DESC);
CREATE INDEX idx_session_debriefs_session ON public.session_debriefs(session_id);

CREATE TRIGGER set_session_debriefs_updated_at
  BEFORE UPDATE ON public.session_debriefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();