import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type UnitSystem = "metric" | "imperial";
const KEY = "summit.units";

export const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" },
  { code: "CHF", symbol: "CHF" },
  { code: "NZD", symbol: "NZ$" },
  { code: "SEK", symbol: "kr" },
  { code: "NOK", symbol: "kr" },
  { code: "DKK", symbol: "kr" },
  { code: "ZAR", symbol: "R" },
  { code: "BRL", symbol: "R$" },
  { code: "MXN", symbol: "MX$" },
  { code: "AED", symbol: "AED" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

// Currency is derived from the device's locale region — there is no manual picker.
const EUROZONE = new Set(["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"]);
const REGION_CURRENCY: Record<string, CurrencyCode> = {
  US: "USD", GB: "GBP", JP: "JPY", AU: "AUD", CA: "CAD", CH: "CHF", NZ: "NZD",
  SE: "SEK", NO: "NOK", DK: "DKK", ZA: "ZAR", BR: "BRL", MX: "MXN", AE: "AED",
};

export function currencyForLocale(locale?: string): CurrencyCode {
  if (typeof navigator === "undefined" && !locale) return "USD";
  try {
    const region = new Intl.Locale(locale || navigator.language).maximize().region;
    if (!region) return "USD";
    if (EUROZONE.has(region)) return "EUR";
    return REGION_CURRENCY[region] ?? "USD";
  } catch {
    return "USD";
  }
}

type Ctx = {
  system: UnitSystem;
  setSystem: (s: UnitSystem) => void;
  toggle: () => void;
  currency: CurrencyCode;
  currencySymbol: string;
  formatCurrency: (amount: number, code?: string) => string;
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
  // Pressure
  pressureUnit: string;        // "psi" | "bar"
  toDisplayPressure: (psi: number) => number;
  fromDisplayPressure: (v: number) => number;
};

const UnitsContext = createContext<Ctx | null>(null);

const round = (n: number, d = 1) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [system, setSystemState] = useState<UnitSystem>("metric");
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(KEY);
    if (stored === "metric" || stored === "imperial") setSystemState(stored);
    setCurrencyState(currencyForLocale());
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
    currency,
    currencySymbol: CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency,
    formatCurrency: (amount, code) => {
      const cc = code || currency;
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: cc, maximumFractionDigits: 2 }).format(amount);
      } catch {
        return `${amount.toFixed(2)} ${cc}`;
      }
    },
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
    pressureUnit: imperial ? "psi" : "bar",
    toDisplayPressure: (psi) => round(imperial ? psi : psi / 14.5038, imperial ? 1 : 2),
    fromDisplayPressure: (v) => imperial ? v : v * 14.5038,
  };

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used within UnitsProvider");
  return ctx;
}