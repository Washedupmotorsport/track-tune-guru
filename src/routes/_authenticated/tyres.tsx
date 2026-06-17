import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Gauge, TrendingDown, GitCompare, Disc } from "lucide-react";
import { TyreSetupPage } from "./tyre-setup";
import { TyreWearPage } from "./tyre-wear";
import { TyreComparePage } from "./tyre-compare";
import { TiresPage } from "./tires";

type TabId = "pressures" | "wear" | "compare" | "setup";
const VALID: TabId[] = ["pressures", "wear", "compare", "setup"];

export const Route = createFileRoute("/_authenticated/tyres")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" && (VALID as string[]).includes(s.tab) ? (s.tab as TabId) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tyres — My Race Engineer" },
      { name: "description", content: "Single source of truth for tyre management: pressures, wear, compound comparison, and tyre-set inventory." },
    ],
  }),
  component: TyresHubPage,
});

const TAB_DEFS: { id: TabId; label: string; icon: typeof Gauge; blurb: string }[] = [
  { id: "pressures", label: "Pressures", icon: Gauge,         blurb: "Cold-pressure baseline & hot-pressure targets" },
  { id: "wear",      label: "Wear",      icon: TrendingDown,  blurb: "Stint tracking, predicted life, change windows" },
  { id: "compare",   label: "Compare",   icon: GitCompare,    blurb: "Grip, warm-up and longevity across compounds" },
  { id: "setup",     label: "Setup",     icon: Disc,          blurb: "Tyre sets: cold/hot, heat cycles, pressure deltas" },
];

function TyresHubPage() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const [tab, setTab] = useState<TabId>(search.tab ?? "pressures");
  useEffect(() => { if (search.tab && search.tab !== tab) setTab(search.tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [search.tab]);

  return (
    <div>
      <div>
        <div className="font-mono text-xs uppercase tracking-widest text-primary inline-flex items-center gap-1">
          <Disc className="w-3 h-3" /> Tyres module
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">Tyres</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          One place for everything tyres — set your cold pressures, track wear,
          compare compounds for the conditions, and manage every set in inventory.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = v as TabId;
          setTab(next);
          nav({ to: "/tyres", search: { tab: next }, replace: true });
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

        <TabsContent value="pressures" className="mt-6"><TyreSetupPage /></TabsContent>
        <TabsContent value="wear"      className="mt-6"><TyreWearPage /></TabsContent>
        <TabsContent value="compare"   className="mt-6"><TyreComparePage /></TabsContent>
        <TabsContent value="setup"     className="mt-6"><TiresPage /></TabsContent>
      </Tabs>
    </div>
  );
}