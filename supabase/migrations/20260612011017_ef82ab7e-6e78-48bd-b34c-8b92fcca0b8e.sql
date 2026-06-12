DROP POLICY IF EXISTS "owners manage shares" ON public.car_shares;

CREATE POLICY "car owners insert shares" ON public.car_shares
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (SELECT 1 FROM public.cars c WHERE c.id = car_shares.car_id AND c.user_id = auth.uid())
  );

CREATE POLICY "car owners update shares" ON public.car_shares
  FOR UPDATE
  USING (
    auth.uid() = owner_id
    AND EXISTS (SELECT 1 FROM public.cars c WHERE c.id = car_shares.car_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (SELECT 1 FROM public.cars c WHERE c.id = car_shares.car_id AND c.user_id = auth.uid())
  );

CREATE POLICY "car owners delete shares" ON public.car_shares
  FOR DELETE
  USING (
    auth.uid() = owner_id
    AND EXISTS (SELECT 1 FROM public.cars c WHERE c.id = car_shares.car_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "photos: update for editors" ON storage.objects;
CREATE POLICY "photos: update for editors"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'photos'
  AND has_car_access((storage.foldername(name))[1]::uuid, auth.uid(), 'editor'::share_role)
)
WITH CHECK (
  bucket_id = 'photos'
  AND has_car_access((storage.foldername(name))[1]::uuid, auth.uid(), 'editor'::share_role)
);

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;