import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWeekend } from "@/lib/active-weekend";
import { exportDebriefPdf } from "@/lib/debrief-pdf";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Exports a branded weekend debrief PDF: driver feedback, the engineering
 * review answers (improved/worsened/issues), suggested changes as action
 * items, and notes. Data is fetched on demand from recorded debriefs.
 */
export function DebriefExportButton({ sessionId, carId }: { sessionId?: string; carId?: string }) {
  const { activeWeekend, activeCar, activeSession } = useActiveWeekend();
  const [busy, setBusy] = useState(false);

  const exportPdf = async () => {
    const car = carId ?? activeCar?.id;
    const session = sessionId ?? activeSession?.id ?? null;
    if (!car) { toast.error("Select a car first"); return; }
    setBusy(true);
    try {
      const debriefQ = supabase
        .from("session_debriefs")
        .select("improved,worsened,confidence_issue,tyre_issue,balance_issue,needs_work,suggested_changes,notes")
        .eq("car_id", car)
        .order("updated_at", { ascending: false })
        .limit(1);
      const feedbackQ = session
        ? supabase.from("driver_feedback").select("category,severity,description,corner").eq("session_id", session).order("recorded_at")
        : supabase.from("driver_feedback").select("category,severity,description,corner").eq("car_id", car).order("recorded_at", { ascending: false }).limit(30);
      const [{ data: debriefs, error: e1 }, { data: feedback, error: e2 }] = await Promise.all([debriefQ, feedbackQ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const d = debriefs?.[0] ?? null;
      const lessons = [
        d?.improved ? `Improved: ${d.improved}` : null,
        d?.worsened ? `Got worse: ${d.worsened}` : null,
        d?.confidence_issue ? `Confidence issue: ${d.confidence_issue}` : null,
        d?.tyre_issue ? `Tyre issue: ${d.tyre_issue}` : null,
        d?.balance_issue ? `Balance issue: ${d.balance_issue}` : null,
        d?.needs_work ? `Needs work: ${d.needs_work}` : null,
      ].filter((x): x is string => !!x);
      exportDebriefPdf({
        weekend: activeWeekend?.title ?? activeCar?.name ?? "Race weekend",
        session: activeSession ? `${activeSession.name} · ${activeSession.session_type}` : null,
        feedback: (feedback ?? []) as { category: string; severity: string; description: string; corner?: string | null }[],
        actions: d?.suggested_changes ? [{ text: d.suggested_changes }] : [],
        lessons,
        notes: d?.notes ?? null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={exportPdf} disabled={busy}>
      {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
      Export debrief PDF
    </Button>
  );
}
