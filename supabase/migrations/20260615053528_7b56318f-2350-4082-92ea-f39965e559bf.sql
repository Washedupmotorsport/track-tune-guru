
ALTER TABLE public.engineering_memory
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS setup_change_id uuid REFERENCES public.setup_changes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS debrief_id uuid REFERENCES public.session_debriefs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tyre_compound text,
  ADD COLUMN IF NOT EXISTS weather text,
  ADD COLUMN IF NOT EXISTS symptoms text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS outcome text;

CREATE INDEX IF NOT EXISTS engineering_memory_car_idx ON public.engineering_memory(car_id);
CREATE INDEX IF NOT EXISTS engineering_memory_track_idx ON public.engineering_memory(track_id);
CREATE INDEX IF NOT EXISTS engineering_memory_event_idx ON public.engineering_memory(event_id);
