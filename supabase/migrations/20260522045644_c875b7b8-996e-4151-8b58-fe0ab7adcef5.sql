CREATE TABLE public.session_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  car_id UUID NOT NULL,
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_shares_token ON public.session_shares(token);
CREATE INDEX idx_session_shares_session ON public.session_shares(session_id);

ALTER TABLE public.session_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view session shares for accessible cars"
ON public.session_shares FOR SELECT
USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));

CREATE POLICY "create session shares"
ON public.session_shares FOR INSERT
WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));

CREATE POLICY "delete session shares"
ON public.session_shares FOR DELETE
USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));