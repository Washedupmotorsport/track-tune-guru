
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS event_id uuid;

CREATE INDEX IF NOT EXISTS sessions_event_id_idx ON public.sessions(event_id);

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned';
