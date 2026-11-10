import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type TyreLog = {
  recorded_at: string;
  tire_set: string;
  compound: string | null;
  cold_fl: number | null; cold_fr: number | null; cold_rl: number | null; cold_rr: number | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
  laps: number | null;
  heat_cycles: number | null;
  tread_fl: number | null; tread_fr: number | null; tread_rl: number | null; tread_rr: number | null;
  ambient_c: number | null; track_c: number | null;
  notes: string | null;
};

const DARK: [number, number, number] = [20, 20, 20];
const RED: [number, number, number] = [227, 6, 19];

const p = (v: number | null) => (v == null ? "—" : String(v));

/** Branded tyre records sheet for a car. */
export function exportTyrePdf({ car, track, logs }: { car: string; track?: string | null; logs: TyreLog[] }) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setFillColor(...RED);
  doc.rect(0, 70, pageW, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("MY RACE ENGINEER", margin, 35);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text("TYRE RECORDS", margin, 52);
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString(), pageW - margin, 35, { align: "right" });

  doc.setTextColor(...DARK);
  doc.setFontSize(14);
  doc.text(`${car}${track ? ` — ${track}` : ""}`, margin, 100);

  autoTable(doc, {
    startY: 115,
    margin: { left: margin, right: margin },
    head: [["Date", "Set", "Compound", "Cold FL/FR/RL/RR", "Hot FL/FR/RL/RR", "Laps", "Cycles", "Tread FL/FR/RL/RR", "Air/Track °C", "Notes"]],
    body: logs.map((l) => [
      new Date(l.recorded_at).toLocaleString(),
      l.tire_set,
      l.compound ?? "—",
      `${p(l.cold_fl)}/${p(l.cold_fr)}/${p(l.cold_rl)}/${p(l.cold_rr)}`,
      `${p(l.hot_fl)}/${p(l.hot_fr)}/${p(l.hot_rl)}/${p(l.hot_rr)}`,
      p(l.laps),
      p(l.heat_cycles),
      `${p(l.tread_fl)}/${p(l.tread_fr)}/${p(l.tread_rl)}/${p(l.tread_rr)}`,
      `${p(l.ambient_c)}/${p(l.track_c)}`,
      (l.notes ?? "").slice(0, 40),
    ]),
    styles: { fontSize: 7.5, cellPadding: 3 },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(`tyre_records_${car.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.pdf`);
}
