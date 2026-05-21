import { useEffect, useState } from "react";

export type FlagSettings = {
  speed: number;        // seconds per cycle
  waveAmount: number;   // degrees of rotation
  darkColor: string;    // hex
  lightColor: string;   // hex
  poleColor: string;    // hex
};

export const DEFAULT_FLAG_SETTINGS: FlagSettings = {
  speed: 1.2,
  waveAmount: 8,
  darkColor: "#1a1a1a",
  lightColor: "#f5f5f5",
  poleColor: "#b0b0b0",
};

const STORAGE_KEY = "waving-flags-settings";

export function loadFlagSettings(): FlagSettings {
  if (typeof window === "undefined") return DEFAULT_FLAG_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FLAG_SETTINGS;
    return { ...DEFAULT_FLAG_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FLAG_SETTINGS;
  }
}

export function saveFlagSettings(settings: FlagSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("waving-flags-updated"));
}

export function useFlagSettings(): FlagSettings {
  const [settings, setSettings] = useState<FlagSettings>(DEFAULT_FLAG_SETTINGS);
  useEffect(() => {
    setSettings(loadFlagSettings());
    const handler = () => setSettings(loadFlagSettings());
    window.addEventListener("waving-flags-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("waving-flags-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return settings;
}

type Props = Partial<FlagSettings> & { className?: string };

export function WavingFlags({ className = "w-12 h-12", ...overrides }: Props) {
  const stored = useFlagSettings();
  const s = { ...stored, ...overrides };
  const patternId = `checkers-${s.darkColor.replace("#", "")}-${s.lightColor.replace("#", "")}`;

  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={s.lightColor} />
          <rect width="3" height="3" fill={s.darkColor} />
          <rect x="3" y="3" width="3" height="3" fill={s.darkColor} />
        </pattern>
        <filter id={`wave-${patternId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="turbulence" baseFrequency="0.03 0.05" numOctaves="2" seed="3" result="turb">
            <animate
              attributeName="baseFrequency"
              dur={`${s.speed * 3}s`}
              values="0.03 0.05;0.05 0.03;0.03 0.05"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="turb" scale={s.waveAmount * 0.5} />
        </filter>
      </defs>

      {/* Flagpole on the left */}
      <line x1="9" y1="60" x2="9" y2="4" stroke={s.poleColor} strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="4" r="1.8" fill={s.poleColor} />

      {/* Big waving flag */}
      <g filter={`url(#wave-${patternId})`}>
        <rect
          x="10"
          y="10"
          width="38"
          height="26"
          fill={`url(#${patternId})`}
          stroke={s.darkColor}
          strokeWidth="0.6"
        />
      </g>
    </svg>
  );
}
