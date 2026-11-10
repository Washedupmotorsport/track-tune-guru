CREATE OR REPLACE FUNCTION public.replace_tyre_layout(p_car_id uuid, p_set_id uuid, p_slots integer[], p_expected_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_ids uuid[]; stamp timestamptz := clock_timestamp();
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 PERFORM id FROM public.cars WHERE id=p_car_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Car unavailable'; END IF;
 PERFORM id FROM public.tyre_sets WHERE id=p_set_id AND car_id=p_car_id AND user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Tyre set does not belong to this car'; END IF;
 IF p_slots IS NULL OR array_length(p_slots,1) <> 4 OR (SELECT array_agg(x ORDER BY x) FROM unnest(p_slots) x) IS DISTINCT FROM ARRAY[1,2,3,4] THEN RAISE EXCEPTION 'Four unique tyre slots required'; END IF;
 SELECT coalesce(array_agg(id ORDER BY id),ARRAY[]::uuid[]) INTO current_ids FROM public.tyre_assignments WHERE car_id=p_car_id AND removed_at IS NULL;
 IF current_ids IS DISTINCT FROM (SELECT coalesce(array_agg(x ORDER BY x),ARRAY[]::uuid[]) FROM unnest(p_expected_ids) x) THEN RAISE EXCEPTION 'Tyre layout changed. Refresh before trying again'; END IF;
 UPDATE public.tyre_assignments SET removed_at=stamp WHERE car_id=p_car_id AND removed_at IS NULL;
 INSERT INTO public.tyre_assignments(user_id,car_id,tyre_set_id,tyre_slot,position,fitted_at)
 SELECT auth.uid(),p_car_id,p_set_id,p_slots[i],(ARRAY['fl','fr','rl','rr'])[i],stamp FROM generate_series(1,4) i;
END $$;
REVOKE ALL ON FUNCTION public.replace_tyre_layout(uuid,uuid,integer[],uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_tyre_layout(uuid,uuid,integer[],uuid[]) TO authenticated;
COMMENT ON FUNCTION public.replace_tyre_layout(uuid,uuid,integer[],uuid[]) IS 'Atomically close and replace an authenticated user tyre layout; failed inserts roll back removal and stale layouts are rejected';