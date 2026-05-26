import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getDiscipline } from "./disciplines";
import { formatLapTime } from "./lap-time";

type Setup = {
  name: string;
  discipline: string;
  track: string | null;
  conditions: string | null;
  notes: string | null;
  setup_data: Record<string, string | number | null | undefined>;
  updated_at: string;
};

type Car = {
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
};

type Lap = {
  lap_number: number | null;
  lap_time_ms: number;
  sector_1_ms: number | null;
  sector_2_ms: number | null;
  sector_3_ms: number | null;
  conditions: string | null;
  notes: string | null;
};

const RED: [number, number, number] = [217, 4, 41];
const DARK: [number, number, number] = [20, 20, 20];
const MUTED: [number, number, number] = [120, 120, 120];

export function exportSetupPdf({ setup, car, laps }: { setup: Setup; car: Car | null; laps: Lap[] }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const disc = getDiscipline(setup.discipline);
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header bar
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
  doc.text(disc.label.toUpperCase() + " · " + disc.tagline.toUpperCase(), margin, 52);

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const dateStr = new Date(setup.updated_at).toLocaleString();
  doc.text(dateStr, pageW - margin, 35, { align: "right" });

  let y = 100;

  // Title
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(setup.name, margin, y);
  y += 18;

  // Car line
  if (car) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    const carLine = [car.year, car.make, car.model].filter(Boolean).join(" ") + (car.name ? ` — ${car.name}` : "");
    doc.text(carLine, margin, y);
    y += 16;
  }

  // Meta row (track / conditions)
  const meta: [string, string][] = [
    ["Track", setup.track || "—"],
    ["Conditions", setup.conditions || "—"],
  ];
  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    body: meta,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: RED, cellWidth: 90 },
      1: { textColor: DARK },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  // Sections
  for (const section of disc.sections) {
    const rows = section.fields.map((f) => {
      const v = setup.setup_data?.[f.key];
      const display = v == null || v === "" ? "—" : String(v) + (f.unit ? " " + f.unit : "");
      return [f.label, display];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[section.title.toUpperCase(), ""]],
      body: rows,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: DARK, textColor: 255, fontStyle: "bold", fontSize: 10 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 160, textColor: DARK },
        1: { textColor: DARK, font: "courier" },
      },
      didDrawPage: () => {
        // page footer
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("My Race Engineer — " + setup.name, margin, pageH - 20);
        doc.text(`Page ${doc.getNumberOfPages()}`, pageW - margin, pageH - 20, { align: "right" });
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Notes
  if (setup.notes && setup.notes.trim()) {
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 60; }
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["SESSION NOTES"]],
      body: [[setup.notes]],
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 8 },
      headStyles: { fillColor: DARK, textColor: 255, fontStyle: "bold" },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Laps
  if (laps.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 140) { doc.addPage(); y = 60; }
    const best = laps.reduce((b, l) => (l.lap_time_ms < b ? l.lap_time_ms : b), laps[0].lap_time_ms);
    const lapRows = laps.map((l) => [
      l.lap_number ?? "",
      formatLapTime(l.lap_time_ms) + (l.lap_time_ms === best ? "  ★" : ""),
      formatLapTime(l.sector_1_ms),
      formatLapTime(l.sector_2_ms),
      formatLapTime(l.sector_3_ms),
      l.conditions ?? "",
      l.notes ?? "",
    ]);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", "LAP", "S1", "S2", "S3", "CONDITIONS", "NOTES"]],
      body: lapRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: DARK, textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { font: "courier", fontStyle: "bold", cellWidth: 65 },
        2: { font: "courier", cellWidth: 55 },
        3: { font: "courier", cellWidth: 55 },
        4: { font: "courier", cellWidth: 55 },
      },
    });
  }

  const safeName = setup.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "setup";
  doc.save(`summit_${safeName}.pdf`);
}