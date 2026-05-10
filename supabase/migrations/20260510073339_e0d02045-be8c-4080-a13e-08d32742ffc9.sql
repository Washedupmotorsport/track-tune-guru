-- Role enum
CREATE TYPE public.share_role AS ENUM ('viewer', 'editor');

-- Shares table
CREATE TABLE public.car_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  shared_with_user_id UUID NOT NULL,
  role public.share_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (car_id, shared_with_user_id)
);

CREATE INDEX idx_car_shares_car ON public.car_shares(car_id);
CREATE INDEX idx_car_shares_user ON public.car_shares(shared_with_user_id);

ALTER TABLE public.car_shares ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_car_owner(_car_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.cars WHERE id = _car_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_car_access(_car_id uuid, _user_id uuid, _min_role public.share_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_car_owner(_car_id, _user_id)
  OR EXISTS (
    SELECT 1 FROM public.car_shares s
    WHERE s.car_id = _car_id
      AND s.shared_with_user_id = _user_id
      AND (
        _min_role = 'viewer'
        OR s.role = 'editor'
      )
  );
$$;

-- Look up a user id by email (for invitations)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
$$;

-- car_shares policies
CREATE POLICY "owners manage shares" ON public.car_shares
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "invitees view their shares" ON public.car_shares
  FOR SELECT USING (auth.uid() = shared_with_user_id);

-- Replace cars policies to allow shared access
DROP POLICY IF EXISTS "users view own cars" ON public.cars;
DROP POLICY IF EXISTS "users update own cars" ON public.cars;
DROP POLICY IF EXISTS "users delete own cars" ON public.cars;
DROP POLICY IF EXISTS "users insert own cars" ON public.cars;

CREATE POLICY "view owned or shared cars" ON public.cars
  FOR SELECT USING (public.has_car_access(id, auth.uid(), 'viewer'));
CREATE POLICY "insert own cars" ON public.cars
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners update cars" ON public.cars
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owners delete cars" ON public.cars
  FOR DELETE USING (auth.uid() = user_id);

-- Replace setups policies
DROP POLICY IF EXISTS "users view own setups" ON public.setups;
DROP POLICY IF EXISTS "users insert own setups" ON public.setups;
DROP POLICY IF EXISTS "users update own setups" ON public.setups;
DROP POLICY IF EXISTS "users delete own setups" ON public.setups;

CREATE POLICY "view setups for accessible cars" ON public.setups
  FOR SELECT USING (public.has_car_access(car_id, auth.uid(), 'viewer'));
CREATE POLICY "edit setups on accessible cars (insert)" ON public.setups
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_car_access(car_id, auth.uid(), 'editor'));
CREATE POLICY "edit setups on accessible cars (update)" ON public.setups
  FOR UPDATE USING (public.has_car_access(car_id, auth.uid(), 'editor'));
CREATE POLICY "edit setups on accessible cars (delete)" ON public.setups
  FOR DELETE USING (public.has_car_access(car_id, auth.uid(), 'editor'));

-- Replace laps policies
DROP POLICY IF EXISTS "users view own laps" ON public.laps;
DROP POLICY IF EXISTS "users insert own laps" ON public.laps;
DROP POLICY IF EXISTS "users update own laps" ON public.laps;
DROP POLICY IF EXISTS "users delete own laps" ON public.laps;

CREATE POLICY "view laps for accessible cars" ON public.laps
  FOR SELECT USING (public.has_car_access(car_id, auth.uid(), 'viewer'));
CREATE POLICY "edit laps on accessible cars (insert)" ON public.laps
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_car_access(car_id, auth.uid(), 'editor'));
CREATE POLICY "edit laps on accessible cars (update)" ON public.laps
  FOR UPDATE USING (public.has_car_access(car_id, auth.uid(), 'editor'));
CREATE POLICY "edit laps on accessible cars (delete)" ON public.laps
  FOR DELETE USING (public.has_car_access(car_id, auth.uid(), 'editor'));