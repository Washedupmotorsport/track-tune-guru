import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function randomToken() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function SessionShareDialog({ sessionId, carId }: { sessionId: string; carId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const sharesQ = useQuery({
    queryKey: ["session-shares", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_shares").select("id, token, created_at, expires_at")
        .eq("session_id", sessionId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = async () => {
    setCreating(true);
    const token = randomToken();
    const { error } = await supabase.from("session_shares").insert({
      session_id: sessionId, car_id: carId, user_id: user!.id, token,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["session-shares", sessionId] });
    toast.success("Share link created");
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("session_shares").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["session-shares", sessionId] });
    toast.success("Revoked");
  };

  const linkFor = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/share/session/${token}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Share2 className="w-4 h-4 mr-1" /> Share</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Share session (read-only)</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Anyone with the link can view this session and its laps.</p>
        <Button onClick={create} disabled={creating} className="w-fit">
          {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Share2 className="w-4 h-4 mr-1" />} Create link
        </Button>
        <div className="space-y-2 mt-2">
          {(sharesQ.data ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded border border-border bg-muted/30 p-2">
              <Input readOnly value={linkFor(s.token)} className="font-mono text-xs" />
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(linkFor(s.token)); toast.success("Copied"); }}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => revoke(s.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          {(sharesQ.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No links yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}