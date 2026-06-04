import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, X } from "lucide-react";
import { getTour } from "@/lib/tours";
import { getCompletedTours, markTourComplete } from "@/lib/tutorial-progress.functions";

type Props = { tourKey: string; forceOpen?: boolean; onClose?: () => void };

export function GuidedTour({ tourKey, forceOpen, onClose }: Props) {
  const tour = getTour(tourKey);
  const fetchCompleted = useServerFn(getCompletedTours);
  const completeFn = useServerFn(markTourComplete);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["tutorial-progress"],
    queryFn: () => fetchCompleted(),
    staleTime: 60_000,
  });

  const completed = (data?.tours ?? []).some((t) => t.tour_key === tourKey);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const opened = useRef(false);

  useEffect(() => {
    if (!tour) return;
    if (forceOpen) {
      setStep(0);
      setOpen(true);
      return;
    }
    if (!data) return;
    if (!completed && !opened.current) {
      opened.current = true;
      setStep(0);
      setOpen(true);
    }
  }, [data, completed, forceOpen, tour]);

  if (!tour || !open) return null;

  const finish = async () => {
    setOpen(false);
    onClose?.();
    try {
      await completeFn({ data: { tourKey } });
      qc.invalidateQueries({ queryKey: ["tutorial-progress"] });
    } catch {
      /* non-blocking */
    }
  };

  const s = tour.steps[step];
  const isLast = step === tour.steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg border border-primary/40 bg-background shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
            {tour.label} · {step + 1}/{tour.steps.length}
          </div>
          <button onClick={finish} aria-label="Close tour" className="text-muted-foreground hover:text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
          <button onClick={finish} className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
            Skip
          </button>
          <button
            onClick={() => (isLast ? finish() : setStep((i) => i + 1))}
            className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 h-9 text-xs font-mono uppercase tracking-widest hover:bg-primary/90"
          >
            {isLast ? "Done" : "Next"} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}