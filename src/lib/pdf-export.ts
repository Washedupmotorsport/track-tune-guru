import jsPDF from "jspdf";
import { formatLapTime } from "./lap-time";

type Session = {
  name: string; session_type: string; track: string | null; driver: string | null;
  weather: string | null; air_temp_c: number | null; track_temp_c: number | null;
  fuel_start_l: number | null; fuel_end_l: number | null; notes: string | null;
  started_at: string;
};
type Lap = {
  lap_number: number | null; lap_time_ms: number;
  sector_1_ms: number | null; sector_2_ms: number | null; sector_3_ms: number | null;
  notes: string | null;
};

export function exportSessionPDF(session: Session, laps: Lap[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 48;

  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("SESSION BRIEF", 48, y); y += 8;
  doc.setDrawColor(200); doc.line(48, y, W - 48, y); y += 20;

  doc.setFontSize(14); doc.text(session.name, 48, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const meta = [
    `Type: ${session.session_type}`,
    `Date: ${new Date(session.started_at).toLocaleString()}`,
    `Track: ${session.track ?? "—"}`,
    `Driver: ${session.driver ?? "—"}`,
    `Weather: ${session.weather ?? "—"}  Air ${session.air_temp_c ?? "—"}°C  Track ${session.track_temp_c ?? "—"}°C`,
    `Fuel: start ${session.fuel_start_l ?? "—"} L  end ${session.fuel_end_l ?? "—"} L`,
  ];
  meta.forEach((m) => { doc.text(m, 48, y); y += 14; });
  y += 8;

  if (laps.length) {
    const best = Math.min(...laps.map((l) => l.lap_time_ms));
    const avg = Math.round(laps.reduce((s, l) => s + l.lap_time_ms, 0) / laps.length);
    doc.setFont("helvetica", "bold"); doc.text(`Laps: ${laps.length}  Best: ${formatLapTime(best)}  Avg: ${formatLapTime(avg)}`, 48, y); y += 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    const cols = ["#", "Lap", "S1", "S2", "S3", "Notes"];
    const xs = [48, 80, 150, 220, 290, 360];
    cols.forEach((c, i) => doc.text(c, xs[i], y));
    y += 12; doc.line(48, y - 4, W - 48, y - 4);
    doc.setFont("helvetica", "normal");
    laps.forEach((l) => {
      if (y > 780) { doc.addPage(); y = 48; }
      doc.text(String(l.lap_number ?? "—"), xs[0], y);
      doc.text(formatLapTime(l.lap_time_ms), xs[1], y);
      doc.text(formatLapTime(l.sector_1_ms), xs[2], y);
      doc.text(formatLapTime(l.sector_2_ms), xs[3], y);
      doc.text(formatLapTime(l.sector_3_ms), xs[4], y);
      doc.text((l.notes ?? "").slice(0, 30), xs[5], y);
      y += 13;
    });
    y += 10;
  }

  if (session.notes) {
    if (y > 720) { doc.addPage(); y = 48; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Notes", 48, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const lines = doc.splitTextToSize(session.notes, W - 96);
    lines.forEach((ln: string) => { if (y > 780) { doc.addPage(); y = 48; } doc.text(ln, 48, y); y += 13; });
  }

  const safe = session.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(`session_${safe}.pdf`);
}