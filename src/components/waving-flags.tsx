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
        <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill={s.lightColor} />
          <rect width="4" height="4" fill={s.darkColor} />
          <rect x="4" y="4" width="4" height="4" fill={s.darkColor} />
        </pattern>
      </defs>

      {/* Crossed flagpoles forming an X. Left pole goes bottom-left → top-right; right pole goes bottom-right → top-left. */}
      {/* Right-leaning pole (behind) */}
      <line x1="14" y1="58" x2="54" y2="8" stroke={s.poleColor} strokeWidth="2" strokeLinecap="round" />
      {/* Left-leaning pole (in front) */}
      <line x1="50" y1="58" x2="10" y2="8" stroke={s.poleColor} strokeWidth="2" strokeLinecap="round" />

      {/* Flag on right-leaning pole, hangs to the right of the top tip (54,8) */}
      <path
        d="M54 8 C44 6, 38 10, 30 8 L30 28 C38 30, 44 26, 54 28 Z"
        fill={`url(#${patternId})`}
        stroke={s.darkColor}
        strokeWidth="0.5"
        style={{
          transformOrigin: "54px 18px",
          animation: `flagWaveRight ${s.speed}s ease-in-out infinite`,
        }}
      />

      {/* Flag on left-leaning pole, hangs to the left of the top tip (10,8) */}
      <path
        d="M10 8 C20 6, 26 10, 34 8 L34 28 C26 30, 20 26, 10 28 Z"
        fill={`url(#${patternId})`}
        stroke={s.darkColor}
        strokeWidth="0.5"
        transform="translate(20 0) scale(-1 1) translate(-24 0)"
        style={{
          transformOrigin: "10px 18px",
          animation: `flagWaveLeft ${s.speed}s ease-in-out infinite`,
        }}
      />

      <style>{`
        @keyframes flagWaveLeft {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(${s.waveAmount}deg); }
          75% { transform: rotate(${-s.waveAmount / 2}deg); }
        }
        @keyframes flagWaveRight {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(${-s.waveAmount}deg); }
          75% { transform: rotate(${s.waveAmount / 2}deg); }
        }
      `}</style>
    </svg>
  );
}
