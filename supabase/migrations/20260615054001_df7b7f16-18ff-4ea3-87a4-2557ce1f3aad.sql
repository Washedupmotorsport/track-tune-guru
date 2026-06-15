
-- 1. Table
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  setup_id uuid REFERENCES public.setups(id) ON DELETE SET NULL,
  setup_change_id uuid REFERENCES public.setup_changes(id) ON DELETE SET NULL,
  tire_stint_id uuid REFERENCES public.tire_stints(id) ON DELETE SET NULL,
  tire_log_id uuid REFERENCES public.tire_logs(id) ON DELETE SET NULL,
  feedback_id uuid REFERENCES public.driver_feedback(id) ON DELETE SET NULL,
  debrief_id uuid REFERENCES public.session_debriefs(id) ON DELETE SET NULL,
  memory_id uuid REFERENCES public.engineering_memory(id) ON DELETE SET NULL,
  lap_id uuid REFERENCES public.laps(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeline_events TO authenticated;
GRANT ALL ON public.timeline_events TO service_role;

-- 3. RLS
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tle_select_own" ON public.timeline_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tle_insert_own" ON public.timeline_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tle_update_own" ON public.timeline_events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tle_delete_own" ON public.timeline_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS timeline_events_user_idx ON public.timeline_events(user_id);
CREATE INDEX IF NOT EXISTS timeline_events_event_idx ON public.timeline_events(event_id);
CREATE INDEX IF NOT EXISTS timeline_events_session_idx ON public.timeline_events(session_id);
CREATE INDEX IF NOT EXISTS timeline_events_occurred_idx ON public.timeline_events(occurred_at DESC);

-- 4. Trigger functions
CREATE OR REPLACE FUNCTION public.tl_log_session_started()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, NEW.event_id, NEW.id, NEW.setup_id, 'session_started',
          'Session started: ' || COALESCE(NEW.name, NEW.session_type, 'Session'),
          NULLIF(trim(coalesce(NEW.session_type,'') || coalesce(' · ' || NEW.driver,'') || coalesce(' · ' || NEW.weather,'')), ''),
          COALESCE(NEW.started_at, now()),
          jsonb_build_object('session_type', NEW.session_type, 'driver', NEW.driver, 'weather', NEW.weather));
  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION public.tl_log_setup_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event uuid;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, setup_change_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'setup_changed',
          'Setup change' || COALESCE(' · ' || NEW.area, ''),
          COALESCE(NEW.summary, NEW.reason),
          COALESCE(NEW.measured_at, NEW.testing_started_at, NEW.created_at, now()),
          jsonb_build_object('area', NEW.area, 'expected_effect', NEW.expected_effect));
  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION public.tl_log_tire_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event uuid;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, tire_log_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'tyre_pressure_changed',
          'Tyre pressures logged' || COALESCE(' · ' || NEW.tire_set, ''),
          COALESCE(NEW.compound, NULL),
          COALESCE(NEW.recorded_at, now()),
          jsonb_build_object('tire_set', NEW.tire_set, 'compound', NEW.compound));
  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION public.tl_log_tire_stint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event uuid;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, tire_stint_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, v_event, NEW.session_id, NEW.id, 'tyre_set_changed',
          'Tyre set fitted: ' || COALESCE(NEW.tire_set, '—'),
          COALESCE(NEW.compound, NULL),
          COALESCE(NEW.recorded_at, now()),
          jsonb_build_object('tire_set', NEW.tire_set, 'compound', NEW.compound));
  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION public.tl_log_driver_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event uuid;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, feedback_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'driver_comment',
          'Driver feedback' || COALESCE(' · ' || NEW.category, ''),
          left(COALESCE(NEW.description, ''), 240),
          COALESCE(NEW.recorded_at, now()),
          jsonb_build_object('category', NEW.category, 'severity', NEW.severity, 'balance', NEW.balance, 'corner', NEW.corner));
  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION public.tl_log_debrief()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event uuid;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM public.sessions WHERE id = NEW.session_id;
  END IF;
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, debrief_id, type, title, description, occurred_at)
  VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'debrief_completed',
          'Debrief completed',
          left(COALESCE(NEW.improved, NEW.needs_work, NEW.worsened, ''), 240),
          COALESCE(NEW.created_at, now()));
  -- Also synthesize a session_completed marker
  IF NEW.session_id IS NOT NULL THEN
    INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, debrief_id, type, title, occurred_at)
    VALUES (NEW.user_id, v_event, NEW.session_id, NEW.setup_id, NEW.id, 'session_completed',
            'Session completed',
            COALESCE(NEW.created_at, now()));
  END IF;
  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION public.tl_log_memory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.timeline_events (user_id, event_id, session_id, setup_id, debrief_id, memory_id, type, title, description, occurred_at, metadata)
  VALUES (NEW.user_id, NEW.event_id, NEW.session_id, NEW.setup_id, NEW.debrief_id, NEW.id, 'memory_created',
          'Notebook entry: ' || NEW.title,
          left(COALESCE(NEW.detail, NEW.conditions, ''), 240),
          COALESCE(NEW.created_at, now()),
          jsonb_build_object('category', NEW.category, 'priority', NEW.priority));
  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION public.tl_log_lap_improved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END$$;

-- 5. Attach triggers
DROP TRIGGER IF EXISTS trg_tl_session_started ON public.sessions;
CREATE TRIGGER trg_tl_session_started AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.tl_log_session_started();

DROP TRIGGER IF EXISTS trg_tl_setup_change ON public.setup_changes;
CREATE TRIGGER trg_tl_setup_change AFTER INSERT ON public.setup_changes
  FOR EACH ROW EXECUTE FUNCTION public.tl_log_setup_change();

DROP TRIGGER IF EXISTS trg_tl_tire_log ON public.tire_logs;
CREATE TRIGGER trg_tl_tire_log AFTER INSERT ON public.tire_logs
  FOR EACH ROW EXECUTE FUNCTION public.tl_log_tire_log();

DROP TRIGGER IF EXISTS trg_tl_tire_stint ON public.tire_stints;
CREATE TRIGGER trg_tl_tire_stint AFTER INSERT ON public.tire_stints
  FOR EACH ROW EXECUTE FUNCTION public.tl_log_tire_stint();

DROP TRIGGER IF EXISTS trg_tl_driver_feedback ON public.driver_feedback;
CREATE TRIGGER trg_tl_driver_feedback AFTER INSERT ON public.driver_feedback
  FOR EACH ROW EXECUTE FUNCTION public.tl_log_driver_feedback();

DROP TRIGGER IF EXISTS trg_tl_debrief ON public.session_debriefs;
CREATE TRIGGER trg_tl_debrief AFTER INSERT ON public.session_debriefs
  FOR EACH ROW EXECUTE FUNCTION public.tl_log_debrief();

DROP TRIGGER IF EXISTS trg_tl_memory ON public.engineering_memory;
CREATE TRIGGER trg_tl_memory AFTER INSERT ON public.engineering_memory
  FOR EACH ROW EXECUTE FUNCTION public.tl_log_memory();

DROP TRIGGER IF EXISTS trg_tl_lap_improved ON public.laps;
CREATE TRIGGER trg_tl_lap_improved AFTER INSERT ON public.laps
  FOR EACH ROW EXECUTE FUNCTION public.tl_log_lap_improved();
