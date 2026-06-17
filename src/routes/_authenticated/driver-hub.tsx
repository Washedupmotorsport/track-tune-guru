import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Gauge, MessageSquare, MapPin, Sparkles, Wrench, Users } from "lucide-react";
import { ConfidencePage } from "./confidence";
import { CornersPage } from "./corners";
import { PhilosophiesPage } from "./philosophies";
import { SympathyPage } from "./sympathy";
import { KnownBehavioursPage } from "./known-behaviours";

type TabId = "confidence" | "feedback" | "corners" | "behaviours" | "sympathy";

const VALID: TabId[] = ["confidence", "feedback", "corners", "behaviours", "sympathy"];

export const Route = createFileRoute("/_authenticated/driver-hub")({
  validateSearch: (s: Record<string, unknown>) => {
    const t = typeof s.tab === "string" && (VALID as string[]).includes(s.tab) ? (s.tab as TabId) : undefined;
    return { tab: t };
  },
  head: () => ({
    meta: [
      { title: "Driver Hub — My Race Engineer" },
      { name: "description", content: "Driver Hub: confidence, feedback, corner notes, known behaviours and mechanical sympathy in one place." },
    ],
  }),
  component: DriverHubPage,
});

const TAB_DEFS: { id: TabId; label: string; icon: typeof Gauge; blurb: string }[] = [
  { id: "confidence", label: "Confidence",         icon: Gauge,         blurb: "Score how the car feels per axle and phase" },
  { id: "feedback",   label: "Driver Feedback",    icon: MessageSquare, blurb: "Setup philosophies tuned to driving style" },
  { id: "corners",    label: "Corner Notes",       icon: MapPin,        blurb: "Per-corner balance and driver complaints" },
  { id: "behaviours", label: "Known Behaviours",   icon: Sparkles,      blurb: "Reusable library of how the car behaves" },
  { id: "sympathy",   label: "Mechanical Sympathy",icon: Wrench,        blurb: "Auto-detected warnings to protect the car" },
];

function DriverHubPage() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const [tab, setTab] = useState<TabId>(search.tab ?? "confidence");
  useEffect(() => { if (search.tab && search.tab !== tab) setTab(search.tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [search.tab]);

  return (
    <div>
      <div>
        <div className="font-mono text-xs uppercase tracking-widest text-primary inline-flex items-center gap-1">
          <Users className="w-3 h-3" /> Driver hub
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">Driver Hub</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Everything about how the driver and the car behave together — confidence, feedback,
          corner notes, known behaviours and mechanical sympathy in one place.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = v as TabId;
          setTab(next);
          nav({ to: "/driver-hub", search: { tab: next }, replace: true });
        }}
        className="mt-6"
      >
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1 justify-start">
          {TAB_DEFS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.id} value={t.id} title={t.blurb} className="gap-1.5">
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="confidence" className="mt-6"><ConfidencePage /></TabsContent>
        <TabsContent value="feedback"   className="mt-6"><PhilosophiesPage /></TabsContent>
        <TabsContent value="corners"    className="mt-6"><CornersPage /></TabsContent>
        <TabsContent value="behaviours" className="mt-6"><KnownBehavioursPage /></TabsContent>
        <TabsContent value="sympathy"   className="mt-6"><SympathyPage /></TabsContent>
      </Tabs>
    </div>
  );
}