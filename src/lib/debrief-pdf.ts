import { jsPDF } from "jspdf";

type FeedbackItem = { category: string; severity: string; description: string; corner?: string | null };
type ActionItem = { text: string; done?: boolean };

const DARK: [number, number, number] = [20, 20, 20];
const RED: [number, number, number] = [227, 6, 19];
const MUTED: [number, number, number] = [120, 120, 120];

/** Branded race-weekend debrief sheet. */
export function exportDebriefPdf({
  weekend, session, feedback, actions, lessons, notes,
}: {
  weekend: string;
  session?: string | null;
  feedback: FeedbackItem[];
  actions: ActionItem[];
  lessons: string[];
  notes?: string | null;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 0;

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
  doc.text("RACE WEEKEND DEBRIEF", margin, 52);
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString(), pageW - margin, 35, { align: "right" });

  y = 105;
  doc.setTextColor(...DARK);
  doc.setFontSize(18);
  doc.text(weekend, margin, y);
  y += 16;
  if (session) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text(session, margin, y);
    y += 14;
  }
  y += 12;

  const section = (title: string) => {
    if (y > 740) { doc.addPage(); y = 48; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...DARK);
    doc.text(title, margin, y);
    y += 8;
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  const para = (text: string, indent = 0) => {
    const lines = doc.splitTextToSize(text, pageW - margin * 2 - indent);
    for (const ln of lines as string[]) {
      if (y > 780) { doc.addPage(); y = 48; }
      doc.text(ln, margin + indent, y);
      y += 13;
    }
  };

  section("Driver feedback");
  if (feedback.length) {
    for (const f of feedback) {
      para(`• [${f.severity.toUpperCase()} · ${f.category}${f.corner ? ` · ${f.corner}` : ""}] ${f.description}`, 4);
      y += 2;
    }
  } else para("No feedback recorded.");
  y += 14;

  section("Action items");
  if (actions.length) {
    for (const a of actions) para(`${a.done ? "☑" : "☐"} ${a.text}`, 4);
  } else para("No action items recorded.");
  y += 14;

  section("Lessons learned");
  if (lessons.length) {
    for (const l of lessons) para(`• ${l}`, 4);
  } else para("No lessons recorded.");
  y += 14;

  if (notes) {
    section("Engineering notes");
    para(notes);
  }

  doc.save(`debrief_${weekend.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.pdf`);
}
