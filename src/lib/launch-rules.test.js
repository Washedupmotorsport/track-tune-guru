import { describe, test, expect } from "bun:test";
import { AI_DAILY_LIMIT, EngineerInput, DeleteAccountInput, ResetPasswordInput, SupportMessageInput, AuthedSupportMessageInput, SupportStatusInput, SUPPORT_DAILY_LIMIT } from "./launch-rules";
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
  test("support message keeps to real bounds and one topic", () => {
    const base = { email: "driver@example.com", message: "Brake pedal goes soft after three laps." };
    expect(SUPPORT_DAILY_LIMIT).toBe(5);
    expect(SupportMessageInput.safeParse(base).success).toBe(true);
    expect(SupportMessageInput.safeParse(base).data.category).toBe("other");
    expect(SupportMessageInput.safeParse({ ...base, email: "Driver@Example.COM" }).data.email).toBe("driver@example.com");
    expect(SupportMessageInput.safeParse({ ...base, message: "too short" }).success).toBe(false);
    expect(SupportMessageInput.safeParse({ ...base, message: "x".repeat(4001) }).success).toBe(false);
    expect(SupportMessageInput.safeParse({ ...base, name: "n".repeat(101) }).success).toBe(false);
    expect(SupportMessageInput.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(SupportMessageInput.safeParse({ ...base, email: "a".repeat(250) + "@example.com" }).success).toBe(false);
    expect(SupportMessageInput.safeParse({ ...base, category: "nonsense" }).success).toBe(false);
    expect(AuthedSupportMessageInput.safeParse({ message: base.message }).success).toBe(true);
    expect(SupportStatusInput.safeParse({ id: "not-a-uuid", status: "resolved" }).success).toBe(false);
    expect(SupportStatusInput.safeParse({ id: "8f1c0b6a-2b3e-4a1f-9c7d-6e5f4a3b2c1d", status: "closed" }).success).toBe(false);
  });
});