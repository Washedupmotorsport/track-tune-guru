import { test, expect, afterEach } from "bun:test";
import {
  BOM_RADAR_URL,
  GENERAL_RADAR_URL,
  radarMapUrl,
  getPosition,
  getCurrentWeather,
} from "./weather.ts";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalFetch = globalThis.fetch;
afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
  globalThis.fetch = originalFetch;
});
function locationMock(onLine = true, denied = false) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    onLine, geolocation: { getCurrentPosition: (resolve, reject) => denied
      ? reject({ code: 1, message: "" })
      : resolve({ coords: { latitude: -27.691, longitude: 152.655 } }) },
  } });
}
test("denied device location yields an actionable error even without a device message", async () => {
  locationMock(true, true);
  await expect(getPosition()).rejects.toThrow("Location is blocked");
});
test("offline weather fails before requesting location or the service", async () => {
  locationMock(false);
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return new Response(); };
  await expect(getCurrentWeather()).rejects.toThrow("internet connection");
  expect(fetched).toBe(false);
});
test("current weather uses the device coordinate and returns measured air and wind", async () => {
  locationMock();
  let requested = "";
  globalThis.fetch = async (url) => {
    requested = String(url);
    return Response.json({ current: { temperature_2m: 26.5, wind_speed_10m: 12.2, weather_code: 61 } });
  };
  expect(await getCurrentWeather()).toEqual({ air_temp_c: 27, wind_kph: 12, weather: "Light rain" });
  expect(requested).toContain("latitude=-27.691&longitude=152.655");
});
test("missing weather values do not become invented or NaN readings", async () => {
  locationMock();
  globalThis.fetch = async () => Response.json({ current: {} });
  await expect(getCurrentWeather()).rejects.toThrow("no current reading");
});
test("weather transport failure supports retry rather than exposing a browser error", async () => {
  locationMock();
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await expect(getCurrentWeather()).rejects.toThrow("Check your connection");
});

test("Bureau radar link points at the live rain radar page", () => {
  expect(BOM_RADAR_URL).toBe(
    "https://www.bom.gov.au/weather-and-climate/rain-radar-and-weather-maps",
  );
});

test("fallback radar link opens the animated radar map", () => {
  expect(GENERAL_RADAR_URL).toContain("rainviewer.com/map.html");
  expect(GENERAL_RADAR_URL).toContain("radar=1");
  expect(GENERAL_RADAR_URL).toContain("ani=1");
});

test("radar link centres on the given coordinate", () => {
  const url = radarMapUrl(-27.545, 152.908);
  expect(url).toContain("lat=-27.5450");
  expect(url).toContain("lon=152.9080");
  expect(url).toContain("z=8");
  expect(url).toContain("radar=1");
});

test("radar link rounds coordinates to four decimals", () => {
  const url = radarMapUrl(12.3456789, 98.7654321);
  expect(url).toContain("lat=12.3457");
  expect(url).toContain("lon=98.7654");
});
