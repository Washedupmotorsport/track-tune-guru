import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const TokenInput = z.object({ token: z.string().min(8).max(128) });

export type PublicSession = {
  session: {
    id: string; name: string; session_type: string;
    track: string | null; driver: string | null; weather: string | null;
    air_temp_c: number | null; track_temp_c: number | null;
    started_at: string; notes: string | null;
  };
  car: { name: string; make: string | null; model: string | null } | null;
  laps: {
    id: string; lap_number: number | null; lap_time_ms: number;
    sector_1_ms: number | null; sector_2_ms: number | null; sector_3_ms: number | null;
    notes: string | null; recorded_at: string;
  }[];
};

export const getPublicSession = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }): Promise<PublicSession> => {
    const { data: share, error: shareErr } = await supabaseAdmin
      .from("session_shares")
      .select("session_id, car_id, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (shareErr) throw new Error(shareErr.message);
    if (!share) throw new Error("Link not found");
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
      throw new Error("Link expired");
    }

    const [{ data: session }, { data: car }, { data: laps }] = await Promise.all([
      supabaseAdmin.from("sessions").select(
        "id, name, session_type, track, driver, weather, air_temp_c, track_temp_c, started_at, notes"
      ).eq("id", share.session_id).single(),
      supabaseAdmin.from("cars").select("name, make, model").eq("id", share.car_id).single(),
      supabaseAdmin.from("laps").select(
        "id, lap_number, lap_time_ms, sector_1_ms, sector_2_ms, sector_3_ms, notes, recorded_at"
      ).eq("session_id", share.session_id).order("recorded_at"),
    ]);

    if (!session) throw new Error("Session missing");
    return { session, car, laps: laps ?? [] };
  });