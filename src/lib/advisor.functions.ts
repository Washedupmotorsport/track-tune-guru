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

// ============================================================
// AI Engineer — recommendations grounded in real weekend data
// ============================================================

const EngineerInput = z.object({
  eventId: z.string().uuid().nullable().optional(),
  weather: z
    .object({
      air_temp_c: z.number().optional(),
      weather: z.string().optional(),
      wind_kph: z.number().optional(),
    })
    .nullable()
    .optional(),
});

export type EngineerRelated = {
  session_id?: string | null;
  setup_id?: string | null;
  tire_log_id?: string | null;
  debrief_id?: string | null;
  memory_id?: string | null;
  feedback_id?: string | null;
};

export type EngineerRecommendation = {
  recommendation: string;
  reason: string;
  supporting_data: string[];
  confidence: "high" | "medium" | "low";
  area?: string;
  related?: EngineerRelated;
};

export type EngineerContext = {
  event: { id: string; title: string; track: string | null; starts_at: string; ends_at: string | null } | null;
  car: { id: string; name: string | null; make: string | null; model: string | null; year: number | null; discipline: string | null } | null;
  track: { id: string; name: string } | null;
  session: { id: string; name: string; session_type: string; started_at: string; weather: string | null; air_temp_c: number | null; track_temp_c: number | null; setup_id: string | null } | null;
  weather: { air_temp_c?: number; weather?: string; wind_kph?: number } | null;
  tyre: { id: string; tire_set: string; compound: string | null; hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null; recorded_at: string } | null;
  setup: { id: string; name: string; is_baseline: boolean; setup_data: unknown; notes: string | null } | null;
  recentChanges: { id: string; summary: string; area: string; reason: string | null; expected_effect: string | null; outcome_status: string; created_at: string }[];
  driverFeedback: { id: string; description: string; severity: string; corner: string | null; category: string; recorded_at: string }[];
  debriefs: { id: string; notes: string | null; balance_issue: string | null; tyre_issue: string | null; confidence_issue: string | null; suggested_changes: string | null; needs_work: string | null; created_at: string }[];
  memory: { id: string; title: string; detail: string | null; category: string; priority: string; occurrences: number; confidence: number }[];
};

export type EngineerResult = {
  summary: string;
  recommendations: EngineerRecommendation[];
  missing: string[];
  context: EngineerContext;
};

const MISSING_LABELS = {
  event: "Active weekend (create or pick one on the Weekends page)",
  car: "Car assigned to the weekend (open the weekend and pick the car)",
  track: "Track assigned to the weekend or session",
  session: "At least one session logged for the weekend",
  weather: "Current weather (enable location on the trackside header or log conditions on the session)",
  tyre: "Tyre pressures (log a tyre set in /tyre-setup)",
  setup: "Active setup (link a setup to the latest session or pick a baseline)",
  driverFeedback: "Driver feedback (capture notes in /debrief)",
  debriefs: "Session debrief (write one in /post-debrief)",
  memory: "Engineering memory (pin recurring traits in /engineering-memory)",
} as const;

export const getEngineerRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EngineerInput.parse(input))
  .handler(async ({ data, context }): Promise<EngineerResult> => {
    const { supabase, userId } = context;

    // ---------- Resolve active event ----------
    let event: EngineerContext["event"] = null;
    let carId: string | null = null;
    let trackId: string | null = null;

    if (data.eventId) {
      const { data: evt } = await supabase
        .from("calendar_events")
        .select("id, title, track, track_id, car_id, starts_at, ends_at")
        .eq("id", data.eventId)
        .eq("user_id", userId)
        .maybeSingle();
      if (evt) {
        event = { id: evt.id, title: evt.title, track: evt.track, starts_at: evt.starts_at, ends_at: evt.ends_at };
        carId = evt.car_id;
        trackId = evt.track_id;
      }
    }

    // ---------- Car ----------
    let car: EngineerContext["car"] = null;
    if (carId) {
      const { data: c } = await supabase
        .from("cars")
        .select("id, name, make, model, year, discipline")
        .eq("id", carId)
        .maybeSingle();
      if (c) car = c as EngineerContext["car"];
    }

    // ---------- Track ----------
    let track: EngineerContext["track"] = null;
    if (trackId) {
      const { data: t } = await supabase.from("tracks").select("id, name").eq("id", trackId).maybeSingle();
      if (t) track = t as EngineerContext["track"];
    }

    // ---------- Sessions for this event ----------
    let session: EngineerContext["session"] = null;
    let sessionIds: string[] = [];
    if (event) {
      const { data: sess } = await supabase
        .from("sessions")
        .select("id, name, session_type, started_at, weather, air_temp_c, track_temp_c, setup_id")
        .eq("event_id", event.id)
        .order("started_at", { ascending: false });
      const list = sess ?? [];
      sessionIds = list.map((s) => s.id);
      session = (list[0] ?? null) as EngineerContext["session"];
    }

    // ---------- Setup ----------
    let setup: EngineerContext["setup"] = null;
    if (session?.setup_id) {
      const { data: s } = await supabase
        .from("setups")
        .select("id, name, is_baseline, setup_data, notes")
        .eq("id", session.setup_id)
        .maybeSingle();
      if (s) setup = s as EngineerContext["setup"];
    }
    if (!setup && carId) {
      const { data: s } = await supabase
        .from("setups")
        .select("id, name, is_baseline, setup_data, notes")
        .eq("car_id", carId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (s && s[0]) setup = s[0] as EngineerContext["setup"];
    }

    // ---------- Tyre log (most recent for these sessions, else latest overall for car) ----------
    let tyre: EngineerContext["tyre"] = null;
    if (sessionIds.length) {
      const { data: t } = await supabase
        .from("tire_logs")
        .select("id, tire_set, compound, hot_fl, hot_fr, hot_rl, hot_rr, recorded_at")
        .in("session_id", sessionIds)
        .order("recorded_at", { ascending: false })
        .limit(1);
      if (t && t[0]) tyre = t[0] as EngineerContext["tyre"];
    }
    if (!tyre && carId) {
      const { data: t } = await supabase
        .from("tire_logs")
        .select("id, tire_set, compound, hot_fl, hot_fr, hot_rl, hot_rr, recorded_at")
        .eq("car_id", carId)
        .order("recorded_at", { ascending: false })
        .limit(1);
      if (t && t[0]) tyre = t[0] as EngineerContext["tyre"];
    }

    // ---------- Recent setup changes ----------
    let recentChanges: EngineerContext["recentChanges"] = [];
    if (setup) {
      const { data: ch } = await supabase
        .from("setup_changes")
        .select("id, summary, area, reason, expected_effect, outcome_status, created_at")
        .eq("setup_id", setup.id)
        .order("created_at", { ascending: false })
        .limit(8);
      recentChanges = (ch ?? []) as EngineerContext["recentChanges"];
    }

    // ---------- Driver feedback ----------
    let driverFeedback: EngineerContext["driverFeedback"] = [];
    if (sessionIds.length) {
      const { data: fb } = await supabase
        .from("driver_feedback")
        .select("id, description, severity, corner, category, recorded_at, session_id")
        .in("session_id", sessionIds)
        .order("recorded_at", { ascending: false })
        .limit(10);
      driverFeedback = (fb ?? []) as EngineerContext["driverFeedback"];
    }
    if (driverFeedback.length === 0) {
      const { data: fb } = await supabase
        .from("driver_feedback")
        .select("id, description, severity, corner, category, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(6);
      driverFeedback = (fb ?? []) as EngineerContext["driverFeedback"];
    }

    // ---------- Debriefs ----------
    let debriefs: EngineerContext["debriefs"] = [];
    if (sessionIds.length) {
      const { data: db } = await supabase
        .from("session_debriefs")
        .select("id, notes, balance_issue, tyre_issue, confidence_issue, suggested_changes, needs_work, created_at")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(5);
      debriefs = (db ?? []) as EngineerContext["debriefs"];
    }

    // ---------- Engineering memory ----------
    let memory: EngineerContext["memory"] = [];
    {
      let q = supabase
        .from("engineering_memory")
        .select("id, title, detail, category, priority, occurrences, confidence, track_id, car_id, status")
        .eq("status", "active")
        .order("pinned", { ascending: false })
        .order("last_observed_at", { ascending: false })
        .limit(8);
      if (trackId) q = q.or(`track_id.eq.${trackId},track_id.is.null`);
      const { data: mem } = await q;
      memory = ((mem ?? []) as EngineerContext["memory"]).slice(0, 8);
    }

    const ctx: EngineerContext = {
      event,
      car,
      track,
      session,
      weather: data.weather ?? null,
      tyre,
      setup,
      recentChanges,
      driverFeedback,
      debriefs,
      memory,
    };

    // ---------- Missing data check ----------
    const missing: string[] = [];
    if (!event) missing.push(MISSING_LABELS.event);
    if (!car) missing.push(MISSING_LABELS.car);
    if (!track && !event?.track) missing.push(MISSING_LABELS.track);
    if (!session) missing.push(MISSING_LABELS.session);
    if (!ctx.weather && !session?.weather) missing.push(MISSING_LABELS.weather);
    if (!tyre) missing.push(MISSING_LABELS.tyre);
    if (!setup) missing.push(MISSING_LABELS.setup);
    if (driverFeedback.length === 0) missing.push(MISSING_LABELS.driverFeedback);
    if (debriefs.length === 0) missing.push(MISSING_LABELS.debriefs);

    // If we have essentially nothing, skip AI — no fabrication.
    const haveAnySignal = !!(setup || tyre || driverFeedback.length || debriefs.length || memory.length);
    if (!event || !haveAnySignal) {
      return {
        summary:
          "Not enough real weekend data yet to make recommendations. Add the items listed below, then try again.",
        recommendations: [],
        missing,
        context: ctx,
      };
    }

    // ---------- Call AI ----------
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are an expert race engineer. You analyse the supplied weekend context and produce concrete, actionable recommendations.

STRICT RULES:
- Use ONLY data provided below. Do NOT invent values, sessions, laps, parts, drivers, weather, or telemetry.
- If something is unknown, omit it — never guess.
- Every recommendation MUST cite which provided records support it via the "related" field (session_id, setup_id, tire_log_id, debrief_id, memory_id or feedback_id) and via "supporting_data" (short quoted/paraphrased lines from the inputs).
- "confidence" reflects how strongly the supplied data supports the recommendation: "high" = multiple corroborating records, "medium" = single clear record, "low" = weak/indirect signal.
- Return 0-6 recommendations. If supplied data is insufficient for any actionable change, return an empty recommendations array and explain in summary.

Respond with strict JSON:
{
  "summary": string,
  "recommendations": [
    {
      "recommendation": string,
      "reason": string,
      "supporting_data": string[],
      "confidence": "high" | "medium" | "low",
      "area": string,
      "related": {
        "session_id"?: string,
        "setup_id"?: string,
        "tire_log_id"?: string,
        "debrief_id"?: string,
        "memory_id"?: string,
        "feedback_id"?: string
      }
    }
  ]
}`;

    const userPrompt = `WEEKEND CONTEXT (real data only, JSON):
${JSON.stringify(ctx, null, 2)}

Use the IDs verbatim when you cite "related". Output JSON only.`;

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
    let parsed: { summary?: string; recommendations?: EngineerRecommendation[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    // Sanitize "related" to only contain IDs we actually supplied (prevents hallucinated IDs).
    const validIds = new Set<string>(
      [
        session?.id,
        setup?.id,
        tyre?.id,
        ...sessionIds,
        ...debriefs.map((d) => d.id),
        ...memory.map((m) => m.id),
        ...driverFeedback.map((f) => f.id),
        ...recentChanges.map((c) => c.id),
      ].filter((x): x is string => !!x),
    );
    const cleanRecs: EngineerRecommendation[] = recommendations.map((r) => {
      const rel = r.related ?? {};
      const clean: EngineerRelated = {};
      const keep = (k: keyof EngineerRelated) => {
        const v = rel[k];
        if (typeof v === "string" && validIds.has(v)) clean[k] = v;
      };
      (Object.keys(rel) as (keyof EngineerRelated)[]).forEach(keep);
      return {
        recommendation: String(r.recommendation ?? ""),
        reason: String(r.reason ?? ""),
        supporting_data: Array.isArray(r.supporting_data) ? r.supporting_data.map(String) : [],
        confidence: (["high", "medium", "low"] as const).includes(r.confidence) ? r.confidence : "low",
        area: r.area ? String(r.area) : undefined,
        related: clean,
      };
    });

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      recommendations: cleanRecs,
      missing,
      context: ctx,
    };
  });