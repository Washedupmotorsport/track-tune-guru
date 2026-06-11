import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Search, Plus, Pencil, Trash2, Flag, Compass, Ruler, Gauge } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tracks")({ component: TracksPage });

type Track = {
  id: string;
  slug: string;
  name: string;
  country: string;
  region: string | null;
  length_m: number | null;
  direction: string | null;
  corner_count: number | null;
  layout_notes: string | null;
  gearing_notes: string | null;
  brake_bias_start: string | null;
  tyre_pressure_notes: string | null;
  camber_toe_notes: string | null;
  setup_tips: string | null;
  weather_sensitivity: string | null;
  is_seed: boolean;
  created_by: string | null;
};

type TrackNote = { id: string; track_id: string; note: string; created_at: string };

function TracksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Track | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const tracksQ = useQuery({
    queryKey: ["tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("*")
        .order("country")
        .order("name");
      if (error) throw error;
      return data as Track[];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const list = tracksQ.data ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((t) =>
      [t.name, t.country, t.region, t.layout_notes, t.setup_tips]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(needle))
    );
  }, [tracksQ.data, q]);

  const selected = useMemo(
    () => (tracksQ.data ?? []).find((t) => t.id === selectedId) ?? filtered[0] ?? null,
    [tracksQ.data, filtered, selectedId]
  );

  const grouped = useMemo(() => {
    const m = new Map<string, Track[]>();
    for (const t of filtered) {
      const key = t.country + (t.region ? ` · ${t.region}` : "");
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    }
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Track database
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Tracks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reference profiles for grassroots, club & national circuits. Attach to any session or weekend.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setAddOpen(true); }} className="shadow-glow">
          <Plus className="w-4 h-4 mr-1" /> Add track
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <aside className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tracks…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          {tracksQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {grouped.map(([region, items]) => (
            <div key={region}>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground px-1 mb-1">
                {region}
              </div>
              <ul className="space-y-1">
                {items.map((t) => {
                  const active = selected?.id === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                          active
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "border-border hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        <div className="font-display font-bold text-sm tracking-tight truncate">
                          {t.name}
                        </div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground truncate">
                          {t.length_m ? `${(t.length_m / 1000).toFixed(2)} km` : "—"}
                          {t.corner_count ? ` · ${t.corner_count} corners` : ""}
                          {t.direction ? ` · ${t.direction === "clockwise" ? "CW" : "CCW"}` : ""}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!tracksQ.isLoading && filtered.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">No tracks match.</div>
          )}
        </aside>

        <section>
          {selected ? (
            <TrackDetail
              track={selected}
              canEdit={!selected.is_seed && selected.created_by === user?.id}
              onEdit={() => { setEditing(selected); setAddOpen(true); }}
              onDelete={async () => {
                if (!confirm("Delete this track?")) return;
                const { error } = await supabase.from("tracks").delete().eq("id", selected.id);
                if (error) return toast.error(error.message);
                toast.success("Track deleted");
                setSelectedId(null);
                qc.invalidateQueries({ queryKey: ["tracks"] });
              }}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Select a track to view its profile.
            </div>
          )}
        </section>
      </div>

      <TrackFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["tracks"] })}
      />
    </div>
  );
}

function TrackDetail({
  track, canEdit, onEdit, onDelete,
}: { track: Track; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const notesQ = useQuery({
    queryKey: ["track-notes", track.id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("track_notes")
        .select("*")
        .eq("track_id", track.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TrackNote[];
    },
    enabled: !!user,
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!draft.trim()) throw new Error("Write a note first");
      const { error } = await supabase.from("track_notes").insert({
        track_id: track.id, user_id: user!.id, note: draft.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["track-notes", track.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("track_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["track-notes", track.id] }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1">
              <Flag className="w-3 h-3" /> {track.country}{track.region ? ` · ${track.region}` : ""}
              {track.is_seed && <Badge variant="secondary" className="ml-2 text-[9px]">Built-in</Badge>}
            </div>
            <h2 className="font-display text-3xl font-bold mt-1">{track.name}</h2>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="w-3.5 h-3.5 mr-1" /> Edit</Button>
              <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Stat icon={Ruler} label="Length" value={track.length_m ? `${(track.length_m / 1000).toFixed(3)} km` : "—"} />
          <Stat icon={Compass} label="Direction" value={track.direction ?? "—"} />
          <Stat icon={Gauge} label="Corners" value={track.corner_count ? String(track.corner_count) : "—"} />
          <Stat icon={Flag} label="Brake bias" value={track.brake_bias_start ?? "—"} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field title="Layout notes" body={track.layout_notes} />
        <Field title="Setup tips" body={track.setup_tips} />
        <Field title="Gearing" body={track.gearing_notes} />
        <Field title="Tyre pressures" body={track.tyre_pressure_notes} />
        <Field title="Camber & toe baseline" body={track.camber_toe_notes} />
        <Field title="Weather sensitivity" body={track.weather_sensitivity} />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary mb-3">Your driver notes</div>
        <div className="flex gap-2">
          <Textarea
            rows={2}
            placeholder="What worked here last time? Brake markers, lines, gotchas…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button onClick={() => addNote.mutate()} disabled={addNote.isPending || !draft.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <ul className="mt-4 space-y-2">
          {(notesQ.data ?? []).map((n) => (
            <li key={n.id} className="flex items-start gap-2 group">
              <div className="flex-1 text-sm whitespace-pre-wrap rounded-md border border-border bg-background/50 p-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground mb-1">
                  {new Date(n.created_at).toLocaleString()}
                </div>
                {n.note}
              </div>
              <Button
                size="sm" variant="ghost"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => delNote.mutate(n.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
          {(notesQ.data ?? []).length === 0 && (
            <li className="text-xs text-muted-foreground">No notes yet for this track.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Flag; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="font-display font-bold text-sm mt-0.5">{value}</div>
    </div>
  );
}

function Field({ title, body }: { title: string; body: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary mb-2">{title}</div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
        {body ?? <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

function TrackFormDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Track | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [f, setF] = useState(() => emptyForm());

  function emptyForm() {
    return {
      name: "", country: "", region: "", length_m: "", direction: "clockwise",
      corner_count: "", layout_notes: "", gearing_notes: "", brake_bias_start: "",
      tyre_pressure_notes: "", camber_toe_notes: "", setup_tips: "", weather_sensitivity: "",
    };
  }

  // Reset when dialog opens/closes or target changes
  useMemo(() => {
    if (!open) return;
    if (editing) {
      setF({
        name: editing.name, country: editing.country, region: editing.region ?? "",
        length_m: editing.length_m ? String(editing.length_m) : "",
        direction: editing.direction ?? "clockwise",
        corner_count: editing.corner_count ? String(editing.corner_count) : "",
        layout_notes: editing.layout_notes ?? "", gearing_notes: editing.gearing_notes ?? "",
        brake_bias_start: editing.brake_bias_start ?? "", tyre_pressure_notes: editing.tyre_pressure_notes ?? "",
        camber_toe_notes: editing.camber_toe_notes ?? "", setup_tips: editing.setup_tips ?? "",
        weather_sensitivity: editing.weather_sensitivity ?? "",
      });
    } else {
      setF(emptyForm());
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!f.name.trim() || !f.country.trim()) throw new Error("Name and country are required");
      const slug = (editing?.slug) ?? `${f.name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const payload = {
        name: f.name.trim(), country: f.country.trim(), region: f.region || null,
        length_m: f.length_m ? Number(f.length_m) : null,
        direction: f.direction || null,
        corner_count: f.corner_count ? Number(f.corner_count) : null,
        layout_notes: f.layout_notes || null, gearing_notes: f.gearing_notes || null,
        brake_bias_start: f.brake_bias_start || null, tyre_pressure_notes: f.tyre_pressure_notes || null,
        camber_toe_notes: f.camber_toe_notes || null, setup_tips: f.setup_tips || null,
        weather_sensitivity: f.weather_sensitivity || null,
      };
      if (editing) {
        const { error } = await supabase.from("tracks").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tracks").insert({
          ...payload, slug, created_by: user!.id, is_seed: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Track updated" : "Track added");
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit track" : "Add track"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Country *</Label><Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></div>
              <div><Label>Region</Label><Input value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Length (m)</Label><Input type="number" value={f.length_m} onChange={(e) => setF({ ...f, length_m: e.target.value })} /></div>
            <div>
              <Label>Direction</Label>
              <select
                className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={f.direction}
                onChange={(e) => setF({ ...f, direction: e.target.value })}
              >
                <option value="clockwise">clockwise</option>
                <option value="anticlockwise">anticlockwise</option>
              </select>
            </div>
            <div><Label>Corners</Label><Input type="number" value={f.corner_count} onChange={(e) => setF({ ...f, corner_count: e.target.value })} /></div>
          </div>
          <div><Label>Layout notes</Label><Textarea rows={2} value={f.layout_notes} onChange={(e) => setF({ ...f, layout_notes: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Gearing</Label><Textarea rows={2} value={f.gearing_notes} onChange={(e) => setF({ ...f, gearing_notes: e.target.value })} /></div>
            <div><Label>Brake bias start</Label><Input value={f.brake_bias_start} onChange={(e) => setF({ ...f, brake_bias_start: e.target.value })} placeholder="55% front" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tyre pressures</Label><Textarea rows={2} value={f.tyre_pressure_notes} onChange={(e) => setF({ ...f, tyre_pressure_notes: e.target.value })} /></div>
            <div><Label>Camber & toe baseline</Label><Textarea rows={2} value={f.camber_toe_notes} onChange={(e) => setF({ ...f, camber_toe_notes: e.target.value })} /></div>
          </div>
          <div><Label>Setup tips</Label><Textarea rows={2} value={f.setup_tips} onChange={(e) => setF({ ...f, setup_tips: e.target.value })} /></div>
          <div><Label>Weather sensitivity</Label><Input value={f.weather_sensitivity} onChange={(e) => setF({ ...f, weather_sensitivity: e.target.value })} placeholder="Low / Medium / High + detail" /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{editing ? "Save changes" : "Add track"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}