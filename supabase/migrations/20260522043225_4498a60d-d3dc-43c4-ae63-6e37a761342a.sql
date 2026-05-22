-- =========================================================
-- SESSIONS
-- =========================================================
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  car_id UUID NOT NULL,
  setup_id UUID,
  name TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'practice', -- practice|qualifying|race|testing
  track TEXT,
  driver TEXT,
  weather TEXT,
  air_temp_c NUMERIC,
  track_temp_c NUMERIC,
  fuel_start_l NUMERIC,
  fuel_end_l NUMERIC,
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view sessions for accessible cars" ON public.sessions
  FOR SELECT USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));
CREATE POLICY "edit sessions on accessible cars (insert)" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "edit sessions on accessible cars (update)" ON public.sessions
  FOR UPDATE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "edit sessions on accessible cars (delete)" ON public.sessions
  FOR DELETE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_sessions_car ON public.sessions(car_id, started_at DESC);
CREATE INDEX idx_sessions_setup ON public.sessions(setup_id);

-- Link laps to sessions (optional)
ALTER TABLE public.laps ADD COLUMN session_id UUID;
CREATE INDEX idx_laps_session ON public.laps(session_id);

-- =========================================================
-- TIRE LOGS
-- =========================================================
CREATE TABLE public.tire_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  car_id UUID NOT NULL,
  session_id UUID,
  setup_id UUID,
  tire_set TEXT NOT NULL,
  compound TEXT,
  heat_cycles INTEGER DEFAULT 0,
  -- cold pressures (psi or bar; store as numeric, user-chosen)
  cold_fl NUMERIC, cold_fr NUMERIC, cold_rl NUMERIC, cold_rr NUMERIC,
  -- hot pressures
  hot_fl NUMERIC, hot_fr NUMERIC, hot_rl NUMERIC, hot_rr NUMERIC,
  -- tread depth mm
  tread_fl NUMERIC, tread_fr NUMERIC, tread_rl NUMERIC, tread_rr NUMERIC,
  ambient_c NUMERIC,
  track_c NUMERIC,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tire_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view tire_logs for accessible cars" ON public.tire_logs
  FOR SELECT USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));
CREATE POLICY "edit tire_logs on accessible cars (insert)" ON public.tire_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "edit tire_logs on accessible cars (update)" ON public.tire_logs
  FOR UPDATE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "edit tire_logs on accessible cars (delete)" ON public.tire_logs
  FOR DELETE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE TRIGGER trg_tire_logs_updated_at BEFORE UPDATE ON public.tire_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_tire_logs_car ON public.tire_logs(car_id, recorded_at DESC);

-- =========================================================
-- MAINTENANCE ITEMS
-- =========================================================
CREATE TABLE public.maintenance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  car_id UUID NOT NULL,
  component TEXT NOT NULL, -- engine, gearbox, brakes_f, brakes_r, oil, coolant, etc.
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'hours', -- hours|cycles|km|miles|days
  current_value NUMERIC NOT NULL DEFAULT 0,
  service_interval NUMERIC, -- e.g. 20 hours
  last_service_value NUMERIC DEFAULT 0,
  last_service_date DATE,
  warn_threshold NUMERIC DEFAULT 0.2, -- warn when within 20% of next service
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view maintenance for accessible cars" ON public.maintenance_items
  FOR SELECT USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));
CREATE POLICY "edit maintenance on accessible cars (insert)" ON public.maintenance_items
  FOR INSERT WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "edit maintenance on accessible cars (update)" ON public.maintenance_items
  FOR UPDATE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "edit maintenance on accessible cars (delete)" ON public.maintenance_items
  FOR DELETE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE TRIGGER trg_maintenance_updated_at BEFORE UPDATE ON public.maintenance_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_maintenance_car ON public.maintenance_items(car_id);

-- =========================================================
-- PARTS INVENTORY
-- =========================================================
CREATE TABLE public.parts_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  car_id UUID, -- nullable: parts shared across cars stay user-scoped
  name TEXT NOT NULL,
  part_number TEXT,
  category TEXT, -- tires, brakes, suspension, fluids, etc.
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  location TEXT, -- trailer bay 3, shelf A
  unit_cost NUMERIC,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parts_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view parts (own or accessible car)" ON public.parts_inventory
  FOR SELECT USING (
    auth.uid() = user_id
    OR (car_id IS NOT NULL AND has_car_access(car_id, auth.uid(), 'viewer'::share_role))
  );
CREATE POLICY "insert parts" ON public.parts_inventory
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (car_id IS NULL OR has_car_access(car_id, auth.uid(), 'editor'::share_role))
  );
CREATE POLICY "update parts" ON public.parts_inventory
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (car_id IS NOT NULL AND has_car_access(car_id, auth.uid(), 'editor'::share_role))
  );
CREATE POLICY "delete parts" ON public.parts_inventory
  FOR DELETE USING (
    auth.uid() = user_id
    OR (car_id IS NOT NULL AND has_car_access(car_id, auth.uid(), 'editor'::share_role))
  );
CREATE TRIGGER trg_parts_updated_at BEFORE UPDATE ON public.parts_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_parts_user ON public.parts_inventory(user_id);
CREATE INDEX idx_parts_car ON public.parts_inventory(car_id);

-- =========================================================
-- CALENDAR EVENTS
-- =========================================================
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  car_id UUID,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'race', -- race|test|deadline|scrutineering|workshop
  track TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view events (own or accessible car)" ON public.calendar_events
  FOR SELECT USING (
    auth.uid() = user_id
    OR (car_id IS NOT NULL AND has_car_access(car_id, auth.uid(), 'viewer'::share_role))
  );
CREATE POLICY "insert events" ON public.calendar_events
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (car_id IS NULL OR has_car_access(car_id, auth.uid(), 'editor'::share_role))
  );
CREATE POLICY "update events" ON public.calendar_events
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (car_id IS NOT NULL AND has_car_access(car_id, auth.uid(), 'editor'::share_role))
  );
CREATE POLICY "delete events" ON public.calendar_events
  FOR DELETE USING (
    auth.uid() = user_id
    OR (car_id IS NOT NULL AND has_car_access(car_id, auth.uid(), 'editor'::share_role))
  );
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_events_user ON public.calendar_events(user_id, starts_at);
CREATE INDEX idx_events_car ON public.calendar_events(car_id, starts_at);

-- =========================================================
-- EXPENSES
-- =========================================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  car_id UUID,
  event_id UUID,
  category TEXT NOT NULL, -- tires|fuel|entry|travel|parts|other
  description TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view expenses (own or accessible car)" ON public.expenses
  FOR SELECT USING (
    auth.uid() = user_id
    OR (car_id IS NOT NULL AND has_car_access(car_id, auth.uid(), 'viewer'::share_role))
  );
CREATE POLICY "insert expenses" ON public.expenses
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (car_id IS NULL OR has_car_access(car_id, auth.uid(), 'editor'::share_role))
  );
CREATE POLICY "update expenses" ON public.expenses
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (car_id IS NOT NULL AND has_car_access(car_id, auth.uid(), 'editor'::share_role))
  );
CREATE POLICY "delete expenses" ON public.expenses
  FOR DELETE USING (
    auth.uid() = user_id
    OR (car_id IS NOT NULL AND has_car_access(car_id, auth.uid(), 'editor'::share_role))
  );
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_expenses_user ON public.expenses(user_id, spent_on DESC);
CREATE INDEX idx_expenses_car ON public.expenses(car_id, spent_on DESC);
CREATE INDEX idx_expenses_event ON public.expenses(event_id);

-- =========================================================
-- ATTACHMENTS (photos linked to records)
-- =========================================================
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  car_id UUID NOT NULL,
  storage_path TEXT NOT NULL, -- path inside the 'photos' bucket
  file_name TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  caption TEXT,
  -- one of these references the attached record
  setup_id UUID,
  session_id UUID,
  lap_id UUID,
  note_id UUID,
  maintenance_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view attachments for accessible cars" ON public.attachments
  FOR SELECT USING (has_car_access(car_id, auth.uid(), 'viewer'::share_role));
CREATE POLICY "insert attachments" ON public.attachments
  FOR INSERT WITH CHECK (auth.uid() = user_id AND has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE POLICY "delete attachments" ON public.attachments
  FOR DELETE USING (has_car_access(car_id, auth.uid(), 'editor'::share_role));
CREATE INDEX idx_attachments_car ON public.attachments(car_id);
CREATE INDEX idx_attachments_setup ON public.attachments(setup_id);
CREATE INDEX idx_attachments_session ON public.attachments(session_id);

-- =========================================================
-- PHOTOS STORAGE BUCKET
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;

-- storage policies: files are stored under {car_id}/{anything}
CREATE POLICY "photos: view for accessible cars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'photos'
  AND has_car_access((storage.foldername(name))[1]::uuid, auth.uid(), 'viewer'::share_role)
);
CREATE POLICY "photos: upload for editors"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos'
  AND has_car_access((storage.foldername(name))[1]::uuid, auth.uid(), 'editor'::share_role)
);
CREATE POLICY "photos: delete for editors"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos'
  AND has_car_access((storage.foldername(name))[1]::uuid, auth.uid(), 'editor'::share_role)
);