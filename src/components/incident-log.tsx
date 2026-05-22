import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const FLAGS: Record<string, string> = {
  yellow: "bg-yellow-400 text-black",
  red: "bg-red-600 text-white",
  black: "bg-black text-white border border-white/30",
  blue: "bg-blue-600 text-white",
  white: "bg-white text-black",
  checkered: "bg-gradient-to-br from-black to-white text-foreground",
  green: "bg-green-600 text-white",
};

type Incident = {
  id: string; flag: string; lap_number: number | null; description: string | null; occurred_at: string;
};

export function IncidentLog({ sessionId, carId }: { sessionId: string; carId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [flag, setFlag] = useState("yellow");
  const [lap, setLap] = useState("");
  const [desc, setDesc] = useState("");

  const q = useQuery({
    queryKey: ["incidents", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("incidents").select("*").eq("session_id", sessionId).order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as Incident[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("incidents").insert({
        user_id: user!.id, car_id: carId, session_id: sessionId, flag,
        lap_number: lap ? parseInt(lap, 10) : null, description: desc || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setLap(""); setDesc(""); qc.invalidateQueries({ queryKey: ["incidents", sessionId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("incidents").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents", sessionId] }),
  });

  const items = q.data ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Flag className="w-4 h-4 text-primary" />
        <h3 className="font-display text-base font-bold uppercase tracking-wider">Incidents & flags</h3>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
        <Select value={flag} onValueChange={setFlag}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.keys(FLAGS).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Lap #" value={lap} onChange={(e) => setLap(e.target.value)} className="font-mono" />
        <Input placeholder="What happened?" value={desc} onChange={(e) => setDesc(e.target.value)} className="md:col-span-3" />
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}><Plus className="w-4 h-4 mr-1" /> Log</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No incidents logged.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 rounded-md border border-border bg-background/40 p-2 text-sm">
              <span className={"font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded " + (FLAGS[i.flag] ?? "bg-muted")}>{i.flag}</span>
              {i.lap_number != null && <span className="font-mono text-xs text-muted-foreground">L{i.lap_number}</span>}
              <span className="flex-1 truncate">{i.description ?? "—"}</span>
              <span className="text-xs text-muted-foreground font-mono">{new Date(i.occurred_at).toLocaleTimeString()}</span>
              <button onClick={() => del.mutate(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}