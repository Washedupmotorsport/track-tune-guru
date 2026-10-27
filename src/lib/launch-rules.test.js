import { describe, test, expect } from "bun:test";
import { AI_DAILY_LIMIT, EngineerInput, DeleteAccountInput, ResetPasswordInput } from "./launch-rules";
import { isPreviewHost } from "./pwa-policy";

describe("pre-launch safety rules", () => {
  test("weather rejects more than 500 characters", () => {
    expect(EngineerInput.safeParse({ weather: { weather: "x".repeat(500) } }).success).toBe(true);
    expect(EngineerInput.safeParse({ weather: { weather: "x".repeat(501) } }).success).toBe(false);
  });
  test("daily allowance is 50 AI calls", () => { expect(AI_DAILY_LIMIT).toBe(50); });
  test("account deletion requires exact confirmation", () => {
    expect(DeleteAccountInput.safeParse({ confirmation: "DELETE" }).success).toBe(true);
    expect(DeleteAccountInput.safeParse({ confirmation: "delete" }).success).toBe(false);
    expect(DeleteAccountInput.safeParse({ confirmation: "" }).success).toBe(false);
  });
  test("reset password confirmation must match", () => {
    expect(ResetPasswordInput.safeParse({ password: "SafePass123", confirm: "SafePass123" }).success).toBe(true);
    expect(ResetPasswordInput.safeParse({ password: "SafePass123", confirm: "Different123" }).success).toBe(false);
  });
  test("published domains remain eligible but preview hosts do not", () => {
    expect(isPreviewHost("track-tune-guru.lovable.app")).toBe(false);
    expect(isPreviewHost("myraceengineer.app")).toBe(false);
    expect(isPreviewHost("preview-v2--shop.example.com")).toBe(false);
    expect(isPreviewHost("id-preview--05a0664b.lovable.app")).toBe(true);
    expect(isPreviewHost("preview-2--app.gpt-eng.com")).toBe(true);
    expect(isPreviewHost("project--abc-dev.lovable.app")).toBe(true);
    expect(isPreviewHost("localhost")).toBe(true);
  });
});