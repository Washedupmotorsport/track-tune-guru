
CREATE OR REPLACE FUNCTION public.tl_log_session_started()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_event uuid;
BEGIN
  IF NEW.event_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.calendar_events WHERE id = NEW.event_id) THEN
    v_event := NEW.event_id;
  ELSE
    v_event := NULL;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, v_event, NEW.id, NEW.setup_id, 'session_started',
          'Session started: ' || COALESCE(NEW.name, NEW.session_type, 'Session'),
          NULLIF(trim(coalesce(NEW.session_type,'') || coalesce(' · ' || NEW.driver,'') || coalesce(' · ' || NEW.weather,'')), ''),
          COALESCE(NEW.started_at, now()),
          jsonb_build_object('session_type', NEW.session_type, 'driver', NEW.driver, 'weather', NEW.weather));
  RETURN NEW;
END$function$;

CREATE OR REPLACE FUNCTION public.tl_log_debrief()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_event uuid;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
    IF v_event IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.calendar_events WHERE id = v_event) THEN
      v_event := NULL;
    END IF;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, debrief_id, type, title, description, occurred_at)
  VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'debrief_completed',
          'Debrief completed',
          left(COALESCE(NEW.improved, NEW.needs_work, NEW.worsened, ''), 240),
          COALESCE(NEW.created_at, now()));
  IF NEW.session_id IS NOT NULL THEN
    INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, debrief_id, type, title, occurred_at)
    VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'session_completed',
            'Session completed',
            COALESCE(NEW.created_at, now()));
  END IF;
  RETURN NEW;
END$function$;

CREATE OR REPLACE FUNCTION public.tl_log_setup_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_event uuid;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
    IF v_event IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.calendar_events WHERE id = v_event) THEN v_event := NULL; END IF;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, setup_change_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'setup_changed',
          'Setup change' || COALESCE(' · ' || NEW.area, ''),
          COALESCE(NEW.summary, NEW.reason),
          COALESCE(NEW.measured_at, NEW.testing_started_at, NEW.created_at, now()),
          jsonb_build_object('area', NEW.area, 'expected_effect', NEW.expected_effect));
  RETURN NEW;
END$function$;

CREATE OR REPLACE FUNCTION public.tl_log_driver_feedback()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_event uuid;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
    IF v_event IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.calendar_events WHERE id = v_event) THEN v_event := NULL; END IF;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, feedback_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'driver_comment',
          'Driver feedback' || COALESCE(' · ' || NEW.category, ''),
          left(COALESCE(NEW.description, ''), 240),
          COALESCE(NEW.recorded_at, now()),
          jsonb_build_object('category', NEW.category, 'severity', NEW.severity, 'balance', NEW.balance, 'corner', NEW.corner));
  RETURN NEW;
END$function$;

CREATE OR REPLACE FUNCTION public.tl_log_tire_stint()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_event uuid;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
    IF v_event IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.calendar_events WHERE id = v_event) THEN v_event := NULL; END IF;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, tire_stint_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, v_event, NEW.session_id, NEW.id, 'tyre_set_changed',
          'Tyre set fitted: ' || COALESCE(NEW.tire_set, '—'),
          COALESCE(NEW.compound, NULL),
          COALESCE(NEW.recorded_at, now()),
          jsonb_build_object('tire_set', NEW.tire_set, 'compound', NEW.compound));
  RETURN NEW;
END$function$;

CREATE OR REPLACE FUNCTION public.tl_log_tire_log()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_event uuid;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
    IF v_event IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.calendar_events WHERE id = v_event) THEN v_event := NULL; END IF;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, tire_log_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'tyre_pressure_changed',
          'Tyre pressures logged' || COALESCE(' · ' || NEW.tire_set, ''),
          COALESCE(NEW.compound, NULL),
          COALESCE(NEW.recorded_at, now()),
          jsonb_build_object('tire_set', NEW.tire_set, 'compound', NEW.compound));
  RETURN NEW;
END$function$;

CREATE OR REPLACE FUNCTION public.tl_log_lap_improved()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_event uuid;
  v_prev_best int;
BEGIN
  IF NEW.lap_time_ms IS NULL OR NEW.session_id IS NULL THEN RETURN NEW; END IF;
  SELECT MIN(lap_time_ms) INTO v_prev_best
  FROM public.laps
  WHERE session_id = NEW.session_id AND id <> NEW.id AND lap_time_ms IS NOT NULL;
  IF v_prev_best IS NULL OR NEW.lap_time_ms < v_prev_best THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
    IF v_event IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.calendar_events WHERE id = v_event) THEN v_event := NULL; END IF;
    INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, lap_id, type, title, description, occurred_at, metadata)
    VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'lap_improved',
            'New session best: lap ' || COALESCE(NEW.lap_number::text, '?'),
            CASE WHEN v_prev_best IS NOT NULL THEN
              'Improved by ' || ((v_prev_best - NEW.lap_time_ms)::numeric / 1000)::text || 's'
            ELSE 'First timed lap of the session' END,
            COALESCE(NEW.recorded_at, now()),
            jsonb_build_object('lap_time_ms', NEW.lap_time_ms, 'prev_best_ms', v_prev_best));
  END IF;
  RETURN NEW;
END$function$;
