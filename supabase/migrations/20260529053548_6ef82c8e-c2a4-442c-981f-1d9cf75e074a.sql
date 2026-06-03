-- Setup change validation workflow: 5-state lifecycle
-- Proposed -> Testing -> Successful / Rejected -> Archived

ALTER TABLE public.setup_changes
  ALTER COLUMN outcome_status SET DEFAULT 'proposed';

-- Track when the change entered each state, plus archive timestamp.
ALTER TABLE public.setup_changes
  ADD COLUMN IF NOT EXISTS testing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS setup_changes_status_idx
  ON public.setup_changes (car_id, outcome_status, created_at DESC);
