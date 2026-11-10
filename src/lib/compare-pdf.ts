import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatLapTime } from "./lap-time";
import { CORRELATION_NOTE, formatDeltaMs, type PerfDelta, type SetupDiffRow } from "./session-compare";

const DARK: [number, number, number] = [20, 20, 20];
const RED: [number, number, number] = [227, 6, 19];

/** Branded session-to-session setup comparison sheet. */
export function exportComparisonPdf({
  nameA, nameB, changes, perf, testNext,
}: {
  nameA: string;
  nameB: string;
  changes: SetupDiffRow[];
  perf: PerfDelta[];
  testNext?: string | null;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
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
  doc.text("SETUP COMPARISON", margin, 52);
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString(), pageW - margin, 35, { align: "right" });

  doc.setTextColor(...DARK);
  doc.setFontSize(13);
  doc.text(`${nameA}  vs  ${nameB}`, margin, 100);

  autoTable(doc, {
    startY: 115,
    margin: { left: margin, right: margin },
    head: [["Setting", nameA.slice(0, 24), nameB.slice(0, 24)]],
    body: changes.map((c) => [c.label, c.a ?? "—", c.b ?? "—"]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  const afterSetup = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  autoTable(doc, {
    startY: afterSetup,
    margin: { left: margin, right: margin },
    head: [["Performance", nameA.slice(0, 24), nameB.slice(0, 24), "Δ (B−A)"]],
    body: perf.map((d) => [
      d.label,
      d.aMs != null ? formatLapTime(d.aMs) : "—",
      d.bMs != null ? formatLapTime(d.bMs) : "—",
      d.deltaMs != null ? formatDeltaMs(d.deltaMs) : "—",
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  for (const ln of doc.splitTextToSize(CORRELATION_NOTE, pageW - margin * 2) as string[]) {
    if (y > 780) { doc.addPage(); y = 48; }
    doc.text(ln, margin, y);
    y += 12;
  }
  if (testNext) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    for (const ln of doc.splitTextToSize(`Proposed next test: ${testNext}`, pageW - margin * 2) as string[]) {
      if (y > 780) { doc.addPage(); y = 48; }
      doc.text(ln, margin, y);
      y += 13;
    }
  }

  doc.save(`comparison_${nameA.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_vs_${nameB.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.pdf`);
}
