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
      {/* Pole leaning right (bottom-left to top-right), drawn behind */}
      <line x1="10" y1="58" x2="46" y2="12" stroke={s.poleColor} strokeWidth="2" strokeLinecap="round" />
      {/* Pole leaning left (bottom-right to top-left), drawn in front */}
      <line x1="54" y1="58" x2="18" y2="12" stroke={s.poleColor} strokeWidth="2" strokeLinecap="round" />

      {/* Right flag flies right from (46,12) */}
      <path
        d="M46 12 C52 10, 56 14, 62 12 L62 30 C56 32, 52 28, 46 30 Z"
        fill={`url(#${patternId})`}
        stroke={s.darkColor}
        strokeWidth="0.5"
        style={{
          transformOrigin: "46px 21px",
          animation: `flagWaveRight ${s.speed}s ease-in-out infinite`,
        }}
      />

      {/* Left flag flies left from (18,12) */}
      <path
        d="M18 12 C12 10, 8 14, 2 12 L2 30 C8 32, 12 28, 18 30 Z"
        fill={`url(#${patternId})`}
        stroke={s.darkColor}
        strokeWidth="0.5"
        style={{
          transformOrigin: "18px 21px",
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
