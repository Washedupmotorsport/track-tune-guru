// Parse lap times like "1:23.456", "83.456", "1:23", "83"
export function parseLapTime(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/^(?:(\d+):)?(\d+)(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const min = m[1] ? parseInt(m[1], 10) : 0;
  const sec = parseInt(m[2], 10);
  const ms = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
  if (sec >= 60 && min > 0) return null;
  return min * 60_000 + sec * 1000 + ms;
}

export function formatLapTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  if (min === 0) return `${sec}.${millis.toString().padStart(3, "0")}`;
  return `${min}:${sec.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}