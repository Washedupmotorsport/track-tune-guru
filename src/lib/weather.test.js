import { test, expect } from "bun:test";
import {
  BOM_RADAR_URL,
  GENERAL_RADAR_URL,
  radarMapUrl,
} from "./weather.ts";

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
