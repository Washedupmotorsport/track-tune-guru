
-- 1. Allow car owners to view their own car_shares
CREATE POLICY "owners view their shares" ON public.car_shares
  FOR SELECT USING (auth.uid() = owner_id);

-- 2. Attachments UPDATE policy
CREATE POLICY "update attachments" ON public.attachments
  FOR UPDATE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role))
  WITH CHECK (
    has_car_access(car_id, auth.uid(), 'editor'::share_role)
    AND auth.uid() = user_id
  );

-- 3. Session shares UPDATE policy
CREATE POLICY "update session shares" ON public.session_shares
  FOR UPDATE
  USING (has_car_access(car_id, auth.uid(), 'editor'::share_role))
  WITH CHECK (
    has_car_access(car_id, auth.uid(), 'editor'::share_role)
    AND auth.uid() = user_id
  );

-- 4. Revoke direct EXECUTE on internal helper from authenticated.
-- has_car_access is SECURITY DEFINER so it does not need this grant to call it internally.
REVOKE EXECUTE ON FUNCTION public.is_car_owner(uuid, uuid) FROM authenticated, anon, public;
