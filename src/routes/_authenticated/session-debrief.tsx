import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ClipboardCheck, MessageSquare, ClipboardList, Brain, CheckCircle2, Flag, Wrench,
} from "lucide-react";
import { DebriefPage } from "./debrief";
import { PostDebriefPage } from "./post-debrief";

type TabId = "feedback" | "review" | "actions" | "lessons" | "setup";
const VALID: TabId[] = ["feedback", "review", "actions", "lessons", "setup"];

type Search = {
  tab?: TabId;
  sessionId?: string;
  carId?: string;
  new?: boolean;
};

export const Route = createFileRoute("/_authenticated/session-debrief")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" && (VALID as string[]).includes(s.tab) ? (s.tab as TabId) : undefined,
    sessionId: typeof s.sessionId === "string" ? s.sessionId : undefined,
    carId: typeof s.carId === "string" ? s.carId : undefined,
    new: s.new === "1" || s.new === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Session Debrief — My Race Engineer" },
      { name: "description", content: "Unified post-session workflow: driver feedback, engineering review, action items and lessons stored in engineering memory." },
    ],
  }),
  component: SessionDebriefPage,
});

const STEPS = [
  { n: 1, tab: "feedback" as TabId, label: "Driver feedback",       icon: MessageSquare },
  { n: 2, tab: "review"   as TabId, label: "Engineering review",    icon: ClipboardList },
  { n: 3, tab: "actions"  as TabId, label: "Action items",          icon: CheckCircle2 },
  { n: 4, tab: "lessons"  as TabId, label: "Lessons learned",       icon: Brain },
  { n: 5, tab: "setup"    as TabId, label: "Setup recommendations", icon: Wrench },
] as const;

const QUESTIONS = [
  "What improved?",
  "What got worse?",
  "Biggest confidence issue?",
  "Biggest tyre issue?",
  "What should be tested next?",
];

function SessionDebriefPage() {
  const search = Route.useSearch();
  const nav = useNavigate();
  // If we arrive with ?new=1&sessionId=..., land on the Engineering review tab.
  const initial: TabId = search.tab ?? (search.new ? "review" : "feedback");
  const [tab, setTab] = useState<TabId>(initial);
  useEffect(() => { if (search.tab && search.tab !== tab) setTab(search.tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [search.tab]);

  return (
    <div>
      <div>
        <div className="font-mono text-xs uppercase tracking-widest text-primary inline-flex items-center gap-1">
          <ClipboardCheck className="w-3 h-3" /> Session debrief
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">Session Debrief</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          One workflow from the chequered flag to lessons learned — collect driver feedback,
          run the engineering review, agree on action items, then pin what matters into engineering memory.
        </p>
      </div>

      {/* WORKFLOW STEPS */}
      <ol className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = s.tab === tab;
          return (
            <li
              key={s.n}
              className={`rounded-md border p-2 flex items-center gap-2 ${
                active ? "border-primary/50 bg-primary/10" : "border-border bg-card"
              }`}
            >
              <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-[10px] font-mono font-bold ${
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>{s.n}</span>
              <Icon className={`w-3.5 h-3.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-[11px] font-mono uppercase tracking-widest truncate">{s.label}</span>
            </li>
          );
        })}
      </ol>

      {/* CORE QUESTIONS — the five prompts driving the engineering review. */}
      <div className="mt-4 rounded-lg border border-border bg-card p-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Answer these in the engineering review</div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
          {QUESTIONS.map((q, i) => (
            <li key={i} className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">{q}</li>
          ))}
        </ul>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = v as TabId;
          setTab(next);
          nav({
            to: "/session-debrief",
            search: (prev: Search) => ({ ...prev, tab: next }),
            replace: true,
          });
        }}
        className="mt-6"
      >
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1 justify-start">
          <TabsTrigger value="feedback" className="gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Driver Feedback
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Engineering Review
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Action Items
          </TabsTrigger>
          <TabsTrigger value="lessons" className="gap-1.5">
            <Brain className="w-3.5 h-3.5" /> Lessons Learned
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-1.5">
            <Wrench className="w-3.5 h-3.5" /> Setup Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="mt-6">
          <DebriefPage />
        </TabsContent>
        <TabsContent value="review" className="mt-6">
          <PostDebriefPage />
        </TabsContent>
        <TabsContent value="actions" className="mt-6">
          <PostDebriefPage />
        </TabsContent>
        <TabsContent value="lessons" className="mt-6">
          <PostDebriefPage />
        </TabsContent>
        <TabsContent value="setup" className="mt-6">
          <PostDebriefPage />
        </TabsContent>
      </Tabs>

      {/* STEP 5 — promote lessons to engineering memory. */}
      <div className="mt-8 rounded-lg border border-dashed border-border bg-card/40 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Brain className="w-4 h-4 text-primary" />
          <span>Found something future-you must remember?</span>
        </div>
        <Link
          to="/engineering-memory"
          className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary text-primary-foreground px-3 h-8 text-[11px] font-mono uppercase tracking-widest hover:opacity-90"
        >
          Pin to engineering memory
        </Link>
      </div>
    </div>
  );
}