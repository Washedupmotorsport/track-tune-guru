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
    // Never surface the driver's error text: this endpoint is unauthenticated.
    if (shareErr) {
      console.error("[getPublicSession] share lookup failed", shareErr);
      throw new Error("Link not found");
    }
    if (!share) throw new Error("Link not found");
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
      throw new Error("Link expired");
    }

    // The share row carries session_id and car_id independently, so a caller who
    // can create a share could otherwise point it at any session in the database.
    // Only serve the session if it genuinely belongs to the shared car.
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "id, car_id, name, session_type, track, driver, weather, air_temp_c, track_temp_c, started_at, notes"
      )
      .eq("id", share.session_id)
      .eq("car_id", share.car_id)
      .maybeSingle();
    if (sessionErr) {
      console.error("[getPublicSession] session lookup failed", sessionErr);
      throw new Error("Link not found");
    }
    if (!session) throw new Error("Link not found");

    const [{ data: car }, { data: laps }] = await Promise.all([
      supabaseAdmin.from("cars").select("name, make, model").eq("id", share.car_id).maybeSingle(),
      // Scope laps to the verified session AND its car, so laps written against
      // another car cannot be attached to this session's public view.
      supabaseAdmin.from("laps").select(
        "id, lap_number, lap_time_ms, sector_1_ms, sector_2_ms, sector_3_ms, notes, recorded_at"
      ).eq("session_id", session.id).eq("car_id", share.car_id).order("recorded_at"),
    ]);

    const { car_id: _carId, ...publicSession } = session;
    return { session: publicSession, car: car ?? null, laps: laps ?? [] };
  });