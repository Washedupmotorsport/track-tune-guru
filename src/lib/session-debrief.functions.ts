import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  debriefId: z.string().uuid(),
});

export type SessionDebriefAI = {
  summary: string;
  recurring_trends: string[];
  next_changes: { area: string; advice: string; priority: "high" | "medium" | "low" }[];
};

export const summarizeSessionDebrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<SessionDebriefAI> => {
    const { supabase } = context;

    const { data: deb, error: dErr } = await supabase
      .from("session_debriefs")
      .select("*")
      .eq("id", data.debriefId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!deb) throw new Error("Debrief not found or access denied");

    // Pull last 8 debriefs for the same car to detect recurring trends.
    const { data: history } = await supabase
      .from("session_debriefs")
      .select("created_at,improved,worsened,needs_work,confidence_issue,tyre_issue,balance_issue,suggested_changes")
      .eq("car_id", deb.car_id)
      .order("created_at", { ascending: false })
      .limit(8);

    // Pull recent lap stats for this session if any.
    let lapStats: { count: number; bestMs: number | null; avgMs: number | null } = { count: 0, bestMs: null, avgMs: null };
    if (deb.session_id) {
      const { data: laps } = await supabase
        .from("laps")
        .select("lap_time_ms")
        .eq("session_id", deb.session_id);
      if (laps && laps.length > 0) {
        const times = laps.map((l) => l.lap_time_ms).filter((n): n is number => !!n);
        if (times.length) {
          lapStats = {
            count: times.length,
            bestMs: Math.min(...times),
            avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
          };
        }
      }
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const system = `You are a senior race engineer running a post-session debrief.
Produce a concise engineering summary, identify recurring trends across the recent debrief history, and propose prioritised next setup changes.
Respond with strict JSON: { "summary": string, "recurring_trends": string[], "next_changes": [{ "area": string, "advice": string, "priority": "high"|"medium"|"low" }] }.
Be concrete. Tie advice to driver complaints. 2-5 next changes.`;

    const user = `Current debrief:
- Improved: ${deb.improved ?? "—"}
- Worsened: ${deb.worsened ?? "—"}
- Still needs work: ${deb.needs_work ?? "—"}
- Biggest confidence issue: ${deb.confidence_issue ?? "—"}
- Biggest tyre issue: ${deb.tyre_issue ?? "—"}
- Biggest balance issue: ${deb.balance_issue ?? "—"}
- Engineer's proposed changes: ${deb.suggested_changes ?? "—"}
- Free notes: ${deb.notes ?? "—"}

Lap stats (this session): ${JSON.stringify(lapStats)}

Recent debrief history (most recent first, up to 8):
${JSON.stringify(history ?? [])}

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
    let parsed: SessionDebriefAI;
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned invalid response");
      parsed = JSON.parse(m[0]);
    }
    parsed.summary ??= "";
    parsed.recurring_trends ??= [];
    parsed.next_changes ??= [];

    // Persist back onto the debrief for later viewing.
    await supabase
      .from("session_debriefs")
      .update({ ai_summary: parsed })
      .eq("id", data.debriefId);

    return parsed;
  });