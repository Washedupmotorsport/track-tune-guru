DROP POLICY IF EXISTS "profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Read own profile or owned car crew" ON public.profiles FOR SELECT TO authenticated USING (
  id = (select auth.uid()) OR EXISTS (
    SELECT 1 FROM public.car_shares s JOIN public.cars c ON c.id = s.car_id
    WHERE s.shared_with_user_id = profiles.id AND s.owner_id = (select auth.uid()) AND c.user_id = (select auth.uid())
  )
);
