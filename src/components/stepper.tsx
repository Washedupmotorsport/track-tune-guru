import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useRef } from "react";

/**
 * Big-touch numeric stepper for pit-lane use.
 * One tap = one step. Long-press (600ms) switches to fine increment (step / 5).
 * Designed to be operated with gloves, in direct sunlight.
 */
export function Stepper({
  label,
  unit,
  value,
  onChange,
  step = 0.1,
  fineStep,
  min,
  max,
  precision = 1,
  disabled,
  accent,
  bgTone,
  className,
}: {
  label?: string;
  unit?: string;
  value: string | number | undefined;
  onChange: (next: string) => void;
  step?: number;
  fineStep?: number;
  min?: number;
  max?: number;
  precision?: number;
  disabled?: boolean;
  accent?: "ok" | "warn" | "hot" | "cold" | "none";
  bgTone?: "cold" | "optimal" | "hot";
  className?: string;
}) {
  const num = typeof value === "number" ? value : parseFloat((value ?? "") as string);
  const valid = Number.isFinite(num);
  const fineStepActual = fineStep ?? step / 5;
  const longPressRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback((delta: number) => {
    if (disabled) return;
    let next = (valid ? num : 0) + delta;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    const factor = Math.pow(10, precision);
    next = Math.round(next * factor) / factor;
    onChange(String(next));
  }, [disabled, valid, num, min, max, precision, onChange]);

  const handlePointerDown = useCallback((direction: 1 | -1) => {
    longPressRef.current = false;
    timerRef.current = setTimeout(() => {
      longPressRef.current = true;
      bump(direction * fineStepActual);
    }, 600);
  }, [bump, fineStepActual]);

  const handlePointerUp = useCallback((direction: 1 | -1) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!longPressRef.current) {
      bump(direction * step);
    }
  }, [bump, step]);

  const handlePointerLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

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

  const bgClass =
    bgTone === "cold"
      ? "bg-blue-500/10"
      : bgTone === "optimal"
      ? "bg-emerald-500/10"
      : bgTone === "hot"
      ? "bg-amber-500/10"
      : "bg-background/40";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <div className="telemetry-label flex items-center justify-between">
          <span>{label}</span>
          {unit && <span className="opacity-70">{unit}</span>}
        </div>
      )}
      <div className={cn("flex items-stretch rounded-md border-[1.5px] overflow-hidden", accentBorder, bgClass)}>
        <button
          type="button"
          aria-label={`Decrease ${label ?? ""}`}
          disabled={disabled}
          onPointerDown={() => handlePointerDown(-1)}
          onPointerUp={() => handlePointerUp(-1)}
          onPointerLeave={handlePointerLeave}
          className="h-12 w-12 shrink-0 flex items-center justify-center bg-muted/40 hover:bg-primary/15 active:bg-primary/30 active:scale-[0.97] transition border-r border-border/70 disabled:opacity-40 touch-manipulation select-none"
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
          onPointerDown={() => handlePointerDown(1)}
          onPointerUp={() => handlePointerUp(1)}
          onPointerLeave={handlePointerLeave}
          className="h-12 w-12 shrink-0 flex items-center justify-center bg-muted/40 hover:bg-primary/15 active:bg-primary/30 active:scale-[0.97] transition border-l border-border/70 disabled:opacity-40 touch-manipulation select-none"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
