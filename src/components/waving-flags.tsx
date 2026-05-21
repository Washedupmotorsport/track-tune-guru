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

      {/* Crossed flagpoles forming an X */}
      {/* Pole leaning right (bottom-left to top-right) */}
      <line x1="8" y1="58" x2="40" y2="16" stroke={s.poleColor} strokeWidth="2" strokeLinecap="round" />
      {/* Pole leaning left (bottom-right to top-left) */}
      <line x1="56" y1="58" x2="24" y2="16" stroke={s.poleColor} strokeWidth="2" strokeLinecap="round" />

      {/* Right flag — hoist edge sits along right-leaning pole at its top, flies up-right.
          Static rotation -37° aligns the hoist with the pole; inner path waves around the attach point. */}
      <g transform="rotate(-37 40 16)">
        <path
          d="M40 16 C46 14, 50 18, 56 16 L56 30 C50 32, 46 28, 40 30 Z"
          fill={`url(#${patternId})`}
          stroke={s.darkColor}
          strokeWidth="0.5"
          style={{
            transformOrigin: "40px 16px",
            animation: `flagWaveRight ${s.speed}s ease-in-out infinite`,
          }}
        />
      </g>

      {/* Left flag — hoist along left-leaning pole, flies up-left. */}
      <g transform="rotate(37 24 16)">
        <path
          d="M24 16 C18 14, 14 18, 8 16 L8 30 C14 32, 18 28, 24 30 Z"
          fill={`url(#${patternId})`}
          stroke={s.darkColor}
          strokeWidth="0.5"
          style={{
            transformOrigin: "24px 16px",
            animation: `flagWaveLeft ${s.speed}s ease-in-out infinite`,
          }}
        />
      </g>

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
