import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Car, Camera, Loader as Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { assertValidImageUpload, IMAGE_ACCEPT_ATTR } from "@/lib/upload-guard";

export function CarPhoto({ carId, photoPath, editable }: { carId: string; photoPath: string | null; editable: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!photoPath) { setUrl(null); return; }
    (async () => {
      const { data } = await supabase.storage.from("photos").createSignedUrl(photoPath, 3600);
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [photoPath]);

  const onPick = async (file: File) => {
    setUploading(true);
    try {
      const { contentType, ext } = assertValidImageUpload(file);
      const path = `${carId}/cover/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("photos").upload(path, file, { contentType });
      if (up.error) throw up.error;
      if (photoPath) await supabase.storage.from("photos").remove([photoPath]);
      const { error } = await supabase.from("cars").update({ photo_path: path }).eq("id", carId);
      if (error) throw error;
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["cars"] });
      qc.invalidateQueries({ queryKey: ["car", carId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/30 border-b border-border/60">
      {url ? (
        <img src={url} alt="Car" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <Car className="w-10 h-10 opacity-30" />
        </div>
      )}
      {editable && (
        <>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}
            disabled={uploading}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-sm bg-background/85 backdrop-blur px-2 py-1 text-[10px] font-mono uppercase tracking-[0.15em] border border-border hover:border-primary hover:text-primary transition-colors"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            {url ? "Change" : "Add photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
          />
        </>
      )}
    </div>
  );
}
