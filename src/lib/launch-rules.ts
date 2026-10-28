import { z } from "zod";

export const AI_DAILY_LIMIT = 50;
export const EngineerInput = z.object({
  eventId: z.string().uuid().nullable().optional(),
  weather: z.object({
    air_temp_c: z.number().optional(),
    weather: z.string().max(500).optional(),
    wind_kph: z.number().optional(),
  }).nullable().optional(),
});
export const DeleteAccountInput = z.object({ confirmation: z.literal("DELETE") });
export const ResetPasswordInput = z.object({
  password: z.string().min(8, "Use at least 8 characters").max(128),
  confirm: z.string(),
}).refine((value) => value.password === value.confirm, {
  message: "Passwords do not match", path: ["confirm"],
});

export const SUPPORT_CATEGORIES = ["bug", "account", "setup", "tyres", "feature", "other"] as const;
export const SUPPORT_DAILY_LIMIT = 5;

const supportEmail = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const supportMessage = z.string().trim()
  .min(10, "Tell us a little more (at least 10 characters)")
  .max(4000, "Keep your message under 4000 characters");

export const SupportMessageInput = z.object({
  email: supportEmail,
  name: z.string().trim().max(100).optional(),
  category: z.enum(SUPPORT_CATEGORIES).default("other"),
  message: supportMessage,
  source: z.enum(["web", "in_app"]).default("web"),
  honeypot: z.string().max(200).optional(),
});

export const AuthedSupportMessageInput = SupportMessageInput.omit({ email: true });

export const SupportStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "resolved"]),
});