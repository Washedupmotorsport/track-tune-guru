export function selectRaceSession<T extends { id: string }>(sessions: T[], manualId: string, activeId?: string) {
  return sessions.find((session) => session.id === manualId)
    ?? sessions.find((session) => session.id === activeId)
    ?? sessions[0] ?? null;
}

export function nextLapNumber(laps: { lap_number: number | null }[]) {
  return Math.max(laps.length, ...laps.map((lap) => lap.lap_number ?? 0)) + 1;
}

export function sessionLogContext(carId: string, weekend: { id: string; car_id: string | null } | null, session: { id: string; car_id: string; event_id: string | null } | null) {
  const matchesSession = session?.car_id === carId && session.event_id === weekend?.id;
  return {
    session_id: matchesSession ? session.id : null,
  };
}