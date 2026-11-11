// Picks a currency from the device's location (time zone), falling back to the
// language region only when the time zone is unknown.
export type RegionCurrency = "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "CHF" | "NZD" | "SEK" | "NOK" | "DKK" | "ZAR" | "BRL" | "MXN" | "AED";

export const CURRENCY_CODES: readonly RegionCurrency[] = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "SEK", "NOK", "DKK", "ZAR", "BRL", "MXN", "AED"];

export function parseCurrencyOverride(value: string | null): RegionCurrency | null {
  return CURRENCY_CODES.find((code) => code === value) ?? null;
}

export function resolveCurrency(override: string | null, detected: RegionCurrency): RegionCurrency {
  return parseCurrencyOverride(override) ?? detected;
}

const EUROZONE = new Set(["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"]);
const REGION_CURRENCY: Record<string, RegionCurrency> = {
  US: "USD", GB: "GBP", JP: "JPY", AU: "AUD", CA: "CAD", CH: "CHF", NZ: "NZD",
  SE: "SEK", NO: "NOK", DK: "DKK", ZA: "ZAR", BR: "BRL", MX: "MXN", AE: "AED",
};

const ZONE_REGION: Record<string, string> = {
  "Europe/London": "GB", "Europe/Belfast": "GB", "Europe/Dublin": "IE", "Europe/Zurich": "CH",
  "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Asia/Tokyo": "JP",
  "Pacific/Auckland": "NZ", "Pacific/Chatham": "NZ", "Africa/Johannesburg": "ZA", "Asia/Dubai": "AE",
  "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Vienna": "AT", "Europe/Lisbon": "PT",
  "Europe/Helsinki": "FI", "Europe/Athens": "GR", "Europe/Luxembourg": "LU", "Europe/Malta": "MT",
  "Europe/Ljubljana": "SI", "Europe/Bratislava": "SK", "Europe/Tallinn": "EE", "Europe/Riga": "LV",
  "Europe/Vilnius": "LT", "Europe/Zagreb": "HR", "Asia/Nicosia": "CY", "Atlantic/Canary": "ES",
  "America/Mexico_City": "MX", "America/Cancun": "MX", "America/Monterrey": "MX", "America/Tijuana": "MX",
  "America/Sao_Paulo": "BR", "America/Manaus": "BR", "America/Fortaleza": "BR", "America/Recife": "BR",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA", "America/Winnipeg": "CA",
  "America/Halifax": "CA", "America/St_Johns": "CA", "America/Regina": "CA", "America/Montreal": "CA",
  "Pacific/Honolulu": "US", "America/Anchorage": "US", "America/Phoenix": "US",
};

export function regionForTimeZone(tz?: string): string | undefined {
  if (!tz) return undefined;
  if (ZONE_REGION[tz]) return ZONE_REGION[tz];
  if (tz.startsWith("Australia/")) return "AU";
  if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Detroit|Boise|Indiana|Kentucky|North_Dakota)/.test(tz)) return "US";
  if (tz.startsWith("US/")) return "US";
  return undefined;
}

function regionToCurrency(region?: string): RegionCurrency | undefined {
  if (!region) return undefined;
  if (EUROZONE.has(region)) return "EUR";
  return REGION_CURRENCY[region];
}

export function currencyForLocation(timeZone?: string, language?: string): RegionCurrency {
  const fromZone = regionToCurrency(regionForTimeZone(timeZone));
  if (fromZone) return fromZone;
  // Only trust an explicit language region (e.g. "en-AU"), never a guessed one from "en".
  try {
    const region = language ? new Intl.Locale(language).region : undefined;
    return regionToCurrency(region) ?? "USD";
  } catch {
    return "USD";
  }
}
