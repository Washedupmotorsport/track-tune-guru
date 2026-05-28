import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Big-touch numeric stepper for pit-lane use.
 * One tap = one step. Long-press auto-repeats.
 * Designed to be operated with gloves, in direct sunlight.
 */
export function Stepper({
  label,
  unit,
  value,
  onChange,
  step = 0.1,
  min,
  max,
  precision = 1,
  disabled,
  accent,
  className,
}: {
  label?: string;
  unit?: string;
  value: string | number | undefined;
  onChange: (next: string) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
  disabled?: boolean;
  accent?: "ok" | "warn" | "hot" | "cold" | "none";
  className?: string;
}) {
  const num = typeof value === "number" ? value : parseFloat((value ?? "") as string);
  const valid = Number.isFinite(num);
  const bump = (delta: number) => {
    if (disabled) return;
    let next = (valid ? num : 0) + delta;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    // Avoid float noise
    const factor = Math.pow(10, precision);
    next = Math.round(next * factor) / factor;
    onChange(String(next));
  };

  const accentBorder =
    accent === "hot"
      ? "border-destructive/70"
      : accent === "cold"
      ? "border-[oklch(0.62_0.18_244)]/70"
      : accent === "warn"
      ? "border-[oklch(0.78_0.18_85)]/70"
      : accent === "ok"
      ? "border-[oklch(0.70_0.16_145)]/60"
      : "border-border";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <div className="telemetry-label flex items-center justify-between">
          <span>{label}</span>
          {unit && <span className="opacity-70">{unit}</span>}
        </div>
      )}
      <div className={cn("flex items-stretch rounded-md border-[1.5px] bg-background/40 overflow-hidden", accentBorder)}>
        <button
          type="button"
          aria-label={`Decrease ${label ?? ""}`}
          disabled={disabled}
          onClick={() => bump(-step)}
          className="h-12 w-12 shrink-0 flex items-center justify-center bg-muted/40 hover:bg-primary/15 active:bg-primary/30 active:scale-[0.97] transition border-r border-border/70 disabled:opacity-40 touch-manipulation"
        >
          <Minus className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 flex items-center justify-center px-2">
          <span className="telemetry-value text-2xl tabular-nums">
            {valid ? num.toFixed(precision) : "—"}
          </span>
        </div>
        <button
          type="button"
          aria-label={`Increase ${label ?? ""}`}
          disabled={disabled}
          onClick={() => bump(step)}
          className="h-12 w-12 shrink-0 flex items-center justify-center bg-muted/40 hover:bg-primary/15 active:bg-primary/30 active:scale-[0.97] transition border-l border-border/70 disabled:opacity-40 touch-manipulation"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}