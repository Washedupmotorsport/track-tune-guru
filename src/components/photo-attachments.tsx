import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";

type Scope = "session_id" | "setup_id" | "maintenance_id" | "lap_id" | "note_id";

type Attachment = {
  id: string; storage_path: string; file_name: string | null;
  mime_type: string | null; caption: string | null;
};

export function PhotoAttachments({ carId, scope, scopeId }: { carId: string; scope: Scope; scopeId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const listQ = useQuery({
    queryKey: ["attachments", scope, scopeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("attachments").select("*").eq(scope, scopeId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Attachment[];
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const items = listQ.data ?? [];
      const next: Record<string, string> = {};
      for (const a of items) {
        const { data } = await supabase.storage.from("photos").createSignedUrl(a.storage_path, 3600);
        if (data?.signedUrl) next[a.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    })();
    return () => { cancelled = true; };
  }, [listQ.data]);

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      if (!user) throw new Error("No user");
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${user.id}/${carId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("photos").upload(path, file, { contentType: file.type });
        if (up.error) throw up.error;
        const { error } = await supabase.from("attachments").insert({
          user_id: user.id, car_id: carId, storage_path: path, file_name: file.name,
          mime_type: file.type, size_bytes: file.size, [scope]: scopeId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Uploaded"); qc.invalidateQueries({ queryKey: ["attachments", scope, scopeId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const del = useMutation({
    mutationFn: async (a: Attachment) => {
      await supabase.storage.from("photos").remove([a.storage_path]);
      const { error } = await supabase.from("attachments").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attachments", scope, scopeId] }),
  });

  const items = listQ.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary" />
          <h3 className="font-display text-base font-bold uppercase tracking-wider">Photos</h3>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} Upload
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) upload.mutate(e.target.files); e.target.value = ""; }} />
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {items.map((a) => (
            <div key={a.id} className="relative group aspect-square rounded-md overflow-hidden border border-border bg-muted">
              {urls[a.id] ? (
                <img src={urls[a.id]} alt={a.file_name ?? ""} className="w-full h-full object-cover" loading="lazy" />
              ) : <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
              <button onClick={() => { if (confirm("Delete?")) del.mutate(a); }}
                className="absolute top-1 right-1 p-1 rounded bg-background/80 opacity-0 group-hover:opacity-100 text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}