CREATE TABLE public.ai_daily_usage (user_id uuid NOT NULL, usage_day date NOT NULL DEFAULT (timezone('utc', now())::date), calls integer NOT NULL DEFAULT 0, PRIMARY KEY(user_id, usage_day));
GRANT ALL ON public.ai_daily_usage TO service_role;
ALTER TABLE public.ai_daily_usage ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.consume_ai_call(p_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used integer;
BEGIN
 INSERT INTO public.ai_daily_usage(user_id,usage_day,calls) VALUES(p_user_id,timezone('utc',now())::date,1)
 ON CONFLICT(user_id,usage_day) DO UPDATE SET calls=ai_daily_usage.calls+1 WHERE ai_daily_usage.calls < 50 RETURNING calls INTO used;
 RETURN used IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.consume_ai_call(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_call(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.delete_account_data(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE car_ids uuid[];
BEGIN
 SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO car_ids FROM public.cars WHERE user_id=p_user_id;
 DELETE FROM public.timeline_events WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.attachments WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.session_shares WHERE user_id=p_user_id;
 DELETE FROM public.car_shares WHERE owner_id=p_user_id OR shared_with_user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.engineering_memory WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.driver_feedback WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.driver_confidence WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.driver_notes WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.known_behaviours WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.track_notes WHERE user_id=p_user_id;
 DELETE FROM public.session_debriefs WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.incidents WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.laps WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.tire_logs WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.tire_stints WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.setup_changes WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.sessions WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.setups WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.damage_reports WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.maintenance_items WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.parts_inventory WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.expenses WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.calendar_events WHERE user_id=p_user_id OR car_id=ANY(car_ids);
 DELETE FROM public.tutorial_progress WHERE user_id=p_user_id;
 DELETE FROM public.ai_daily_usage WHERE user_id=p_user_id;
 DELETE FROM public.cars WHERE user_id=p_user_id;
END; $$;
REVOKE ALL ON FUNCTION public.delete_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_data(uuid) TO service_role;