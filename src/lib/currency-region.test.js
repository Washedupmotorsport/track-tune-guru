import { test, expect } from "bun:test";
import { currencyForLocation } from "./currency-region";

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
