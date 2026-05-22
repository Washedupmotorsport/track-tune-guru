DROP POLICY IF EXISTS "profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "profiles viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);