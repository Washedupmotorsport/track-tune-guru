import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getDiscipline } from "./disciplines";

const InputSchema = z.object({
  setupId: z.string().uuid(),
  weather: z.string().max(500).optional().default(""),
  goal: z.string().max(1000).optional().default(""),
  driverNotes: z.string().max(2000).optional().default(""),
});

export type AdvisorRecommendation = {
  area: string;
  change: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

export type AdvisorResult = {
  summary: string;
  recommendations: AdvisorRecommendation[];
};

export const getSetupAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: setup, error } = await supabase
      .from("setups")
      .select("*, cars(*)")
      .eq("id", data.setupId)
      .eq("user_id", userId)
      .single();
    if (error || !setup) throw new Error("Setup not found");

    const car = setup.cars as { name: string; make: string | null; model: string | null; year: number | null; discipline: string } | null;
    const disc = getDiscipline(setup.discipline);

    const fieldGuide = disc.sections.map((s) => ({
      section: s.title,
      fields: s.fields.map((f) => `${f.key} (${f.label}${f.unit ? ` ${f.unit}` : ""})`),
    }));

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are an expert race engineer specializing in ${disc.label} (${disc.tagline}).
You analyze car setups and recommend concrete, actionable changes. Be specific with values and direction (e.g. "increase rear ARB by 1 step", "drop front PSI by 1.5 to 26.5").
Always respond with strict JSON matching: { "summary": string, "recommendations": [{ "area": string, "change": string, "reason": string, "priority": "high"|"medium"|"low" }] }.
Provide 3-7 prioritized recommendations. Use only fields applicable to this discipline.`;

    const userPrompt = `Car: ${car ? `${car.year ?? ""} ${car.make ?? ""} ${car.model ?? ""} (${car.name})`.trim() : "unknown"}
Discipline: ${disc.label}
Track: ${setup.track ?? "n/a"}
Conditions on file: ${setup.conditions ?? "n/a"}
Current weather / track conditions: ${data.weather || "not specified"}
Driver goal: ${data.goal || "improve overall balance"}
Driver notes / feedback: ${data.driverNotes || setup.notes || "none"}

Current setup values (JSON):
${JSON.stringify(setup.setup_data, null, 2)}

Available setup fields for this discipline:
${JSON.stringify(fieldGuide, null, 2)}

Respond with the JSON object only, no prose.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Rate limited. Try again shortly.");
    if (res.status === 402) throw new Error("Out of engineer credits. Top up in workspace settings.");
    if (!res.ok) throw new Error(`Race engineer service error (${res.status})`);

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    let parsed: AdvisorResult;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Race engineer returned a malformed response");
      parsed = JSON.parse(match[0]);
    }

    if (!Array.isArray(parsed.recommendations)) parsed.recommendations = [];
    parsed.summary = parsed.summary ?? "";

    return parsed;
  });