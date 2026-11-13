export type TemperatureSnapshot = {
  id: string;
  t: number;
  minute: number;
  air: number;
  track: number;
  hotAvg: number | null;
  grip: number;
  surface: "dry" | "damp" | "wet";
  laps: number;
  note: string;
};

export function temperatureSnapshotPayload(
  userId: string,
  sessionId: string,
  carId: string,
  snap: TemperatureSnapshot,
) {
  if (!userId || !sessionId || !carId || !Number.isFinite(snap.air) || !Number.isFinite(snap.track))
    throw new Error("Choose a session and enter valid temperatures");
  return {
    user_id: userId,
    session_id: sessionId,
    type: "temperature_snapshot",
    title: "Track temperature snapshot",
    description: snap.note || null,
    occurred_at: new Date(snap.t).toISOString(),
    metadata: { ...snap, car_id: carId },
  };
}

export function readTemperatureSnapshot(row: {
  id: string;
  metadata: unknown;
}): TemperatureSnapshot | null {
  if (!row.metadata || typeof row.metadata !== "object") return null;
  const m = row.metadata as Partial<TemperatureSnapshot>;
  if (
    typeof m.air !== "number" ||
    typeof m.track !== "number" ||
    typeof m.t !== "number" ||
    !Number.isFinite(m.air) ||
    !Number.isFinite(m.track) ||
    !Number.isFinite(m.t)
  )
    return null;
  return {
    id: row.id,
    t: m.t,
    minute: m.minute ?? 0,
    air: m.air,
    track: m.track,
    hotAvg: m.hotAvg ?? null,
    grip: m.grip ?? 6,
    surface: m.surface ?? "dry",
    laps: m.laps ?? 0,
    note: m.note ?? "",
  };
}
