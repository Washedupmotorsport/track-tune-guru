import { parseLapTime } from "./lap-time";

export type ParsedLap = {
  lap_number: number | null;
  lap_time_ms: number;
  sector_1_ms: number | null;
  sector_2_ms: number | null;
  sector_3_ms: number | null;
  conditions: string | null;
  notes: string | null;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === "," || c === ";" || c === "\t") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalize(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_MAP: Record<string, keyof ParsedLap | "skip"> = {};
const add = (k: keyof ParsedLap | "skip", ...names: string[]) => {
  for (const n of names) HEADER_MAP[normalize(n)] = k;
};
add("lap_number", "lap", "lapnumber", "lap#", "#", "lapno", "no", "num");
add("lap_time_ms", "laptime", "time", "lap", "totaltime", "duration");
add("sector_1_ms", "s1", "sector1", "sect1", "sec1");
add("sector_2_ms", "s2", "sector2", "sect2", "sec2");
add("sector_3_ms", "s3", "sector3", "sect3", "sec3");
add("conditions", "conditions", "weather", "condition");
add("notes", "notes", "comment", "comments", "note");

// "lap" is ambiguous — prefer time only if no other time column exists
export type ParseResult = {
  laps: ParsedLap[];
  errors: { row: number; reason: string }[];
  headersUsed: Partial<Record<keyof ParsedLap, string>>;
  unrecognizedHeaders: string[];
  rawHeaders: string[];
};

export function parseLapCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { laps: [], errors: [{ row: 0, reason: "Empty file" }], headersUsed: {} };

  const rawHeaders = splitCsvLine(lines[0]);
  const colMap: Array<keyof ParsedLap | null> = rawHeaders.map(() => null);
  const headersUsed: Partial<Record<keyof ParsedLap, string>> = {};

  // First pass: unambiguous matches
  rawHeaders.forEach((h, i) => {
    const n = normalize(h);
    const mapped = HEADER_MAP[n];
    if (mapped && mapped !== "skip" && mapped !== "lap_time_ms" && !(mapped === "lap_number" && n === "lap")) {
      colMap[i] = mapped;
      headersUsed[mapped] = h;
    }
  });
  // Second pass: time-y headers
  rawHeaders.forEach((h, i) => {
    if (colMap[i]) return;
    const n = normalize(h);
    if (["laptime", "time", "totaltime", "duration"].includes(n) && !headersUsed.lap_time_ms) {
      colMap[i] = "lap_time_ms";
      headersUsed.lap_time_ms = h;
    }
  });
  // Third pass: bare "lap" → lap_number if not taken, else time
  rawHeaders.forEach((h, i) => {
    if (colMap[i]) return;
    const n = normalize(h);
    if (n === "lap") {
      if (!headersUsed.lap_number) { colMap[i] = "lap_number"; headersUsed.lap_number = h; }
      else if (!headersUsed.lap_time_ms) { colMap[i] = "lap_time_ms"; headersUsed.lap_time_ms = h; }
    }
  });

  if (!headersUsed.lap_time_ms) {
    return { laps: [], errors: [{ row: 0, reason: "No lap time column found. Expected a header like 'Lap Time', 'Time', or 'Duration'." }], headersUsed };
  }

  const laps: ParsedLap[] = [];
  const errors: { row: number; reason: string }[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]);
    const row: Partial<ParsedLap> = {};
    let badTime = false;
    cells.forEach((v, i) => {
      const key = colMap[i];
      if (!key || !v) return;
      if (key === "lap_number") {
        const n = parseInt(v, 10);
        if (Number.isFinite(n)) row.lap_number = n;
      } else if (key === "conditions" || key === "notes") {
        row[key] = v;
      } else {
        const ms = parseLapTime(v);
        if (ms == null) {
          if (key === "lap_time_ms") badTime = true;
        } else {
          row[key] = ms;
        }
      }
    });
    if (badTime || row.lap_time_ms == null) {
      errors.push({ row: r + 1, reason: "Could not parse lap time" });
      continue;
    }
    laps.push({
      lap_number: row.lap_number ?? null,
      lap_time_ms: row.lap_time_ms,
      sector_1_ms: row.sector_1_ms ?? null,
      sector_2_ms: row.sector_2_ms ?? null,
      sector_3_ms: row.sector_3_ms ?? null,
      conditions: row.conditions ?? null,
      notes: row.notes ?? null,
    });
  }
  return { laps, errors, headersUsed };
}