import { test, expect } from "bun:test";
import { currencyForLocation, parseCurrencyOverride, resolveCurrency } from "./currency-region";

test("manual AUD overrides a US device time zone", () => {
  expect(resolveCurrency("AUD", currencyForLocation("America/New_York", "en-US"))).toBe("AUD");
});
test("manual USD overrides an Australian device time zone", () => {
  expect(resolveCurrency("USD", currencyForLocation("Australia/Brisbane", "en"))).toBe("USD");
});
test("clearing the override restores device currency", () => {
  expect(resolveCurrency(null, currencyForLocation("Australia/Brisbane", "en-US"))).toBe("AUD");
});
test("invalid stored overrides fall back to automatic detection", () => {
  expect(parseCurrencyOverride("INVALID")).toBeNull();
  expect(resolveCurrency("INVALID", "GBP")).toBe("GBP");
});

test("Brisbane device with US English browser gets AUD", () => {
  expect(currencyForLocation("Australia/Brisbane", "en-US")).toBe("AUD");
});
test("Australian device with plain English browser gets AUD", () => {
  expect(currencyForLocation("Australia/Sydney", "en")).toBe("AUD");
});
test("London time zone gets GBP", () => {
  expect(currencyForLocation("Europe/London", "en-US")).toBe("GBP");
});
test("unknown zone falls back to explicit language region", () => {
  expect(currencyForLocation("Etc/UTC", "en-NZ")).toBe("NZD");
});
test("unknown zone and plain language falls back to USD", () => {
  expect(currencyForLocation(undefined, "en")).toBe("USD");
});
