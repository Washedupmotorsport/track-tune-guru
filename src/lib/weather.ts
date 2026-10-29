export type WeatherSnap = {
  air_temp_c: number;
  weather: string;
  wind_kph: number;
};

const CODE: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Showers",
  81: "Heavy showers",
  82: "Violent showers",
  95: "Thunderstorm",
  96: "T-storm + hail",
  99: "Severe t-storm",
};

/** Bureau of Meteorology rain radar (Australia). */
export const BOM_RADAR_URL =
  "https://www.bom.gov.au/weather-and-climate/rain-radar-and-weather-maps";

/** Live radar map used when we can't tell where the user is. */
export const GENERAL_RADAR_URL = "https://www.rainviewer.com/map.html?radar=1&ani=1";

/** Browser-only: ask the device where it is. Rejects if denied or unavailable. */
export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("No geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
  });
}

/** Live radar map centred on a coordinate. */
export function radarMapUrl(latitude: number, longitude: number): string {
  const lat = latitude.toFixed(4);
  const lon = longitude.toFixed(4);
  return `https://www.rainviewer.com/map.html?lat=${lat}&lon=${lon}&z=8&radar=1&ani=1`;
}

export async function getCurrentWeather(): Promise<WeatherSnap> {
  const pos = await getPosition();
  const { latitude, longitude } = pos.coords;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Weather fetch failed");
  const j = await r.json();
  const c = j.current;
  return {
    air_temp_c: Math.round(c.temperature_2m),
    weather: CODE[c.weather_code] ?? "Unknown",
    wind_kph: Math.round(c.wind_speed_10m),
  };
}
