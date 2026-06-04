import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCompletedTours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("tutorial_progress")
      .select("tour_key, completed_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { tours: data ?? [] };
  });

export const markTourComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ tourKey: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("tutorial_progress")
      .upsert(
        { user_id: userId, tour_key: data.tourKey, completed_at: new Date().toISOString() },
        { onConflict: "user_id,tour_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetTour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ tourKey: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("tutorial_progress")
      .delete()
      .eq("user_id", userId)
      .eq("tour_key", data.tourKey);
    if (error) throw new Error(error.message);
    return { ok: true };
  });