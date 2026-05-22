import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  sessionId: z.string().uuid().optional(),
  setupId: z.string().uuid().optional(),
  carId: z.string().uuid(),
}).refine((v) => v.sessionId || v.setupId, { message: "sessionId or setupId required" });

export type DebriefResult = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  actions: { area: string; advice: string; priority: "high" | "medium" | "low" }[];
};

export const getDebrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let lapQ = supabase.from("laps").select("*").eq("car_id", data.carId);
    if (data.sessionId) lapQ = lapQ.eq("session_id", data.sessionId);
    else if (data.setupId) lapQ = lapQ.eq("setup_id", data.setupId);
    const { data: laps, error: lapErr } = await lapQ.order("recorded_at");
    if (lapErr) throw new Error(lapErr.message);

    if (!laps || laps.length === 0) throw new Error("No laps to analyze");

    const times = laps.map((l) => l.lap_time_ms);
    const best = Math.min(...times);
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const stdev = Math.round(
      Math.sqrt(times.reduce((a, b) => a + (b - avg) ** 2, 0) / times.length),
    );

    const fmt = (ms: number) => {
      const m = Math.floor(ms / 60000);
      const s = ((ms % 60000) / 1000).toFixed(3);
      return m > 0 ? `${m}:${s.padStart(6, "0")}` : `${s}s`;
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const lapSummary = laps.map((l, i) => ({
      i: i + 1,
      n: l.lap_number,
      t: fmt(l.lap_time_ms),
      s1: l.sector_1_ms ? fmt(l.sector_1_ms) : null,
      s2: l.sector_2_ms ? fmt(l.sector_2_ms) : null,
      s3: l.sector_3_ms ? fmt(l.sector_3_ms) : null,
      notes: l.notes,
    }));

    const system = `You are a senior race engineer. Analyze lap data and give a tight debrief.
Respond with strict JSON: { "summary": string, "strengths": string[], "weaknesses": string[], "actions": [{ "area": string, "advice": string, "priority": "high"|"medium"|"low" }] }
Keep it concrete. Reference specific lap numbers and sectors. 2-5 actions.`;

    const user = `Stats: best ${fmt(best)}, avg ${fmt(avg)}, consistency stdev ${fmt(stdev)} over ${laps.length} laps.
Laps: ${JSON.stringify(lapSummary)}
Identify where time is being lost, consistency issues, tire/brake fade patterns, and concrete next steps.
Respond with JSON only.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Rate limited. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) throw new Error(`AI error (${res.status})`);

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    let parsed: DebriefResult;
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned invalid response");
      parsed = JSON.parse(m[0]);
    }
    parsed.summary ??= "";
    parsed.strengths ??= [];
    parsed.weaknesses ??= [];
    parsed.actions ??= [];
    return parsed;
  });