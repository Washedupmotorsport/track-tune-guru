import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Timer, Disc, Wrench, Package, CalendarDays, Receipt, BarChart3,
  Calculator, Wand2, NotebookPen, Car, Settings2, Flag, Brain, BookMarked,
} from "lucide-react";

type Hit =
  | { kind: "car"; id: string; label: string }
  | { kind: "session"; id: string; label: string; sub: string | null }
  | { kind: "setup"; id: string; label: string; sub: string | null }
  | { kind: "note"; id: string; label: string };

const PAGES: { label: string; to: string; icon: React.ReactNode }[] = [
  { label: "Garage", to: "/garage", icon: <Car className="w-4 h-4" /> },
  { label: "Sessions", to: "/sessions", icon: <Timer className="w-4 h-4" /> },
  { label: "Analysis", to: "/analysis", icon: <BarChart3 className="w-4 h-4" /> },
  { label: "Tires", to: "/tires", icon: <Disc className="w-4 h-4" /> },
  { label: "Maintenance", to: "/maintenance", icon: <Wrench className="w-4 h-4" /> },
  { label: "Inventory", to: "/inventory", icon: <Package className="w-4 h-4" /> },
  { label: "Calendar", to: "/calendar", icon: <CalendarDays className="w-4 h-4" /> },
  { label: "Expenses", to: "/expenses", icon: <Receipt className="w-4 h-4" /> },
  { label: "Calculators", to: "/calculators", icon: <Calculator className="w-4 h-4" /> },
  { label: "Baseline", to: "/baseline", icon: <Wand2 className="w-4 h-4" /> },
  { label: "Notes", to: "/notes", icon: <NotebookPen className="w-4 h-4" /> },
  { label: "Engineering memory", to: "/engineering-memory", icon: <Brain className="w-4 h-4" /> },
  { label: "Setup library", to: "/setup-library", icon: <BookMarked className="w-4 h-4" /> },
  { label: "Post-session debrief", to: "/post-debrief", icon: <NotebookPen className="w-4 h-4" /> },
  { label: "Flags", to: "/flags", icon: <Flag className="w-4 h-4" /> },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setHits([]); return; }
    let cancelled = false;
    (async () => {
      const like = `%${q}%`;
      const [carsR, sessR, setR, notesR] = await Promise.all([
        supabase.from("cars").select("id, name").ilike("name", like).limit(5),
        supabase.from("sessions").select("id, name, track").or(`name.ilike.${like},track.ilike.${like}`).limit(5),
        supabase.from("setups").select("id, name, track").or(`name.ilike.${like},track.ilike.${like}`).limit(5),
        supabase.from("driver_notes").select("id, title").ilike("title", like).limit(5),
      ]);
      if (cancelled) return;
      const next: Hit[] = [
        ...((carsR.data ?? []).map((r) => ({ kind: "car" as const, id: r.id, label: r.name }))),
        ...((sessR.data ?? []).map((r) => ({ kind: "session" as const, id: r.id, label: r.name, sub: r.track }))),
        ...((setR.data ?? []).map((r) => ({ kind: "setup" as const, id: r.id, label: r.name, sub: r.track }))),
        ...((notesR.data ?? []).map((r) => ({ kind: "note" as const, id: r.id, label: r.title }))),
      ];
      setHits(next);
    })();
    return () => { cancelled = true; };
  }, [query, open]);

  const go = (to: string) => { setOpen(false); setQuery(""); navigate({ to: to as never }); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search sessions, setups, cars, notes…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {hits.length > 0 && (
          <CommandGroup heading="Results">
            {hits.map((h) => (
              <CommandItem key={`${h.kind}-${h.id}`} onSelect={() => {
                if (h.kind === "car") go(`/cars/${h.id}`);
                else if (h.kind === "session") go(`/sessions/${h.id}`);
                else if (h.kind === "setup") go(`/setups/${h.id}`);
                else go("/notes");
              }}>
                {h.kind === "car" && <Car className="w-4 h-4 mr-2" />}
                {h.kind === "session" && <Timer className="w-4 h-4 mr-2" />}
                {h.kind === "setup" && <Settings2 className="w-4 h-4 mr-2" />}
                {h.kind === "note" && <NotebookPen className="w-4 h-4 mr-2" />}
                <span>{h.label}</span>
                {"sub" in h && h.sub && <span className="ml-auto text-xs text-muted-foreground">{h.sub}</span>}
                <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">{h.kind}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {PAGES.map((p) => (
            <CommandItem key={p.to} onSelect={() => go(p.to)}>
              <span className="mr-2">{p.icon}</span>{p.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}