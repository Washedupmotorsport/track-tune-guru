import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Share2, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";

type Role = "viewer" | "editor";

type ShareRow = {
  id: string;
  shared_with_user_id: string;
  role: Role;
  created_at: string;
  profile?: { display_name: string | null } | null;
};

export function ShareDialog({ carId, carName, trigger }: { carId: string; carName: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const qc = useQueryClient();

  const sharesQ = useQuery({
    queryKey: ["shares", carId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("car_shares")
        .select("id, shared_with_user_id, role, created_at")
        .eq("car_id", carId)
        .order("created_at");
      if (error) throw error;
      const rows = data as ShareRow[];
      if (rows.length === 0) return rows;
      const ids = rows.map((r) => r.shared_with_user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: map.get(r.shared_with_user_id) ?? null }));
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const trimmed = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(trimmed)) throw new Error("Enter a valid email");
      const { data: lookup, error: lookupErr } = await supabase.rpc("get_user_id_by_email", { _email: trimmed });
      if (lookupErr) throw lookupErr;
      if (!lookup) throw new Error("No Summit Racing user with that email");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      if (lookup === user.id) throw new Error("That's you");
      const { error } = await supabase.from("car_shares").upsert(
        { car_id: carId, owner_id: user.id, shared_with_user_id: lookup, role },
        { onConflict: "car_id,shared_with_user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Crew member added");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["shares", carId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, newRole }: { id: string; newRole: Role }) => {
      const { error } = await supabase.from("car_shares").update({ role: newRole }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shares", carId] }),
  });

  const removeShare = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("car_shares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["shares", carId] }); },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" variant="outline"><Share2 className="w-4 h-4 mr-1" /> Share</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Share "{carName}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
            <div>
              <Label>Crew member email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => invite.mutate()} disabled={invite.isPending || !email}>
              {invite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Invite"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            They must already have a Summit Racing account. Editors can change setups & log laps; viewers are read-only.
          </p>
        </div>

        <div className="mt-4">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Crew</div>
          {sharesQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : sharesQ.data && sharesQ.data.length > 0 ? (
            <div className="space-y-2">
              {sharesQ.data.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{s.profile?.display_name ?? "User"}</div>
                    <div className="text-xs font-mono text-muted-foreground truncate">{s.shared_with_user_id.slice(0, 8)}…</div>
                  </div>
                  <Select value={s.role} onValueChange={(v) => updateRole.mutate({ id: s.id, newRole: v as Role })}>
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={() => removeShare.mutate(s.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No one yet — invite your crew above.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}