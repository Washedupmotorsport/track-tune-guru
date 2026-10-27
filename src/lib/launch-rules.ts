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