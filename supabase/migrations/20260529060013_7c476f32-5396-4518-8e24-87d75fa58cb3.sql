ALTER TABLE public.engineering_memory
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'monitor';

UPDATE public.engineering_memory SET priority = 'monitor' WHERE priority IS NULL;

CREATE INDEX IF NOT EXISTS engineering_memory_priority_idx
  ON public.engineering_memory (car_id, priority, status);