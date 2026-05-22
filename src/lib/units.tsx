import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type UnitSystem = "metric" | "imperial";
const KEY = "summit.units";

type Ctx = {
  system: UnitSystem;
  setSystem: (s: UnitSystem) => void;
  toggle: () => void;
  // Temperature
  tempUnit: string;            // "°C" | "°F"
  toDisplayTemp: (c: number | null | undefined) => number | null;
  fromDisplayTemp: (v: number | null | undefined) => number | null;
  // Speed
  speedUnit: string;           // "kph" | "mph"
  toDisplaySpeed: (kph: number) => number;
  // Mass
  massUnit: string;            // "kg" | "lb"
  toDisplayMass: (kg: number) => number;
  fromDisplayMass: (v: number) => number;
  // Length (short, suspension scale)
  lengthShortUnit: string;     // "mm" | "in"
  toDisplayLengthShort: (mm: number) => number;
};

const UnitsContext = createContext<Ctx | null>(null);

const round = (n: number, d = 1) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [system, setSystemState] = useState<UnitSystem>("metric");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(KEY);
    if (stored === "metric" || stored === "imperial") setSystemState(stored);
  }, []);

  const setSystem = useCallback((s: UnitSystem) => {
    setSystemState(s);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, s);
  }, []);

  const imperial = system === "imperial";

  const value: Ctx = {
    system,
    setSystem,
    toggle: () => setSystem(imperial ? "metric" : "imperial"),
    tempUnit: imperial ? "°F" : "°C",
    toDisplayTemp: (c) => c == null ? null : round(imperial ? c * 9 / 5 + 32 : c, 1),
    fromDisplayTemp: (v) => v == null ? null : (imperial ? (v - 32) * 5 / 9 : v),
    speedUnit: imperial ? "mph" : "kph",
    toDisplaySpeed: (kph) => Math.round(imperial ? kph * 0.621371 : kph),
    massUnit: imperial ? "lb" : "kg",
    toDisplayMass: (kg) => Math.round(imperial ? kg * 2.20462 : kg),
    fromDisplayMass: (v) => imperial ? v / 2.20462 : v,
    lengthShortUnit: imperial ? "in" : "mm",
    toDisplayLengthShort: (mm) => round(imperial ? mm / 25.4 : mm, imperial ? 2 : 0),
  };

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used within UnitsProvider");
  return ctx;
}