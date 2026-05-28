import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, NotebookPen, Plus, Trash2, Tag, Pencil, X, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes")({
  component: NotesPage,
});

type Car = { id: string; name: string };
type Setup = { id: string; name: string; car_id: string };
type Note = {
  id: string;
  user_id: string;
  car_id: string | null;
  setup_id: string | null;
  title: string;
  body: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type Scope = "all" | "standalone" | "car" | "setup";

function NotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [scope, setScope] = useState<Scope>("all");
  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);

  const carsQ = useQuery({
    queryKey: ["cars", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    },
    enabled: !!user,
  });

  const setupsQ = useQuery({
    queryKey: ["setups-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("setups").select("id, name, car_id").order("created_at");
      if (error) throw error;
      return data as Setup[];
    },
    enabled: !!user,
  });

  const notesQ = useQuery({
    queryKey: ["driver_notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_notes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
    enabled: !!user,
  });

  const filtered = (notesQ.data ?? []).filter((n) => {
    if (scope === "standalone") return !n.car_id && !n.setup_id;
    if (scope === "car") return !!n.car_id && !n.setup_id;
    if (scope === "setup") return !!n.setup_id;
    return true;
  });

  const carName = (id: string | null) => carsQ.data?.find((c) => c.id === id)?.name;
  const setupName = (id: string | null) => setupsQ.data?.find((s) => s.id === id)?.name;

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("driver_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver_notes"] });
      toast.success("Note deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>

      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <NotebookPen className="w-3 h-3" /> Logbook
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Driver notes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Session debriefs, track impressions, to-do lists. Attach to a car, a setup, or keep it standalone.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setCreating(true); }}>
          <Plus className="w-4 h-4 mr-1" /> New note
        </Button>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="standalone">Standalone</TabsTrigger>
          <TabsTrigger value="car">Car-linked</TabsTrigger>
          <TabsTrigger value="setup">Setup-linked</TabsTrigger>
        </TabsList>
      </Tabs>

      {(creating || editing) && (
        <div className="mt-6">
          <NoteEditor
            note={editing}
            cars={carsQ.data ?? []}
            setups={setupsQ.data ?? []}
            userId={user!.id}
            onDone={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["driver_notes"] }); }}
            onCancel={() => { setCreating(false); setEditing(null); }}
          />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {notesQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!notesQ.isLoading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <NotebookPen className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No notes yet in this view.</p>
          </div>
        )}
        {filtered.map((n) => (
          <article key={n.id} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold">{n.title}</h2>
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-1 flex flex-wrap gap-2">
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  {n.car_id && <span>· car: {carName(n.car_id) ?? "—"}</span>}
                  {n.setup_id && <span>· setup: {setupName(n.setup_id) ?? "—"}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setCreating(false); setEditing(n); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => {
                  if (confirm("Delete this note?")) deleteMut.mutate(n.id);
                }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </header>
            {n.body && (
              <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed">{n.body}</p>
            )}
            {n.tags && n.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {n.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="font-mono text-[10px]">
                    <Tag className="w-3 h-3 mr-1" /> {t}
                  </Badge>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function NoteEditor({
  note, cars, setups, userId, onDone, onCancel,
}: {
  note: Note | null;
  cars: Car[];
  setups: Setup[];
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [carId, setCarId] = useState<string>(note?.car_id ?? "none");
  const [setupId, setSetupId] = useState<string>(note?.setup_id ?? "none");
  const [tagsInput, setTagsInput] = useState((note?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  const filteredSetups = carId !== "none" ? setups.filter((s) => s.car_id === carId) : setups;

  const save = async () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: title.trim(),
      body: body.trim() || null,
      car_id: carId === "none" ? null : carId,
      setup_id: setupId === "none" ? null : setupId,
      tags,
    };
    try {
      if (note) {
        const { error } = await supabase.from("driver_notes").update(payload).eq("id", note.id);
        if (error) throw error;
        toast.success("Note updated");
      } else {
        const { error } = await supabase.from("driver_notes").insert({ ...payload, user_id: userId });
        if (error) throw error;
        toast.success("Note saved");
      }
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/40 bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-bold uppercase tracking-wider">
          {note ? "Edit note" : "New note"}
        </h2>
        <Button size="icon" variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1"
            placeholder="e.g. Brands Hatch — wet session debrief" />
        </div>

        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Notes</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mt-1"
            placeholder="What did the car do? What did you try? What's next?" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Car (optional)</Label>
            <Select value={carId} onValueChange={(v) => { setCarId(v); setSetupId("none"); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— standalone —</SelectItem>
                {cars.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Setup (optional)</Label>
            <Select value={setupId} onValueChange={setSetupId} disabled={filteredSetups.length === 0}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {filteredSetups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Tags <span className="text-primary">(comma separated)</span>
          </Label>
          <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="mt-1 font-mono"
            placeholder="wet, oversteer, tires" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {note ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}