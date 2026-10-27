import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DeleteAccountInput } from "./launch-rules";

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteAccountInput.parse(input))
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cars, error: carError } = await supabaseAdmin.from("cars").select("id").eq("user_id", userId);
    if (carError) throw new Error("Unable to load account data. Your account has not been deleted.");
    // Enumerate every owned-car photo, including files without attachment rows.
    const paths = new Set<string>();
    async function listFiles(prefix: string) {
      let offset = 0;
      while (true) {
        const { data, error } = await supabaseAdmin.storage.from("photos").list(prefix, { limit: 100, offset });
        if (error) throw new Error("Unable to delete account photos. Please try again.");
        for (const file of data ?? []) {
          const path = `${prefix}/${file.name}`;
          if (file.id) paths.add(path); else await listFiles(path);
        }
        if (!data || data.length < 100) break;
        offset += data.length;
      }
    }
    for (const car of cars ?? []) await listFiles(car.id);
    let offset = 0;
    while (true) {
      const { data, error } = await supabaseAdmin.from("attachments").select("storage_path").eq("user_id", userId).range(offset, offset + 99);
      if (error) throw new Error("Unable to load account photos. Please try again.");
      for (const attachment of data ?? []) paths.add(attachment.storage_path);
      if (!data || data.length < 100) break;
      offset += data.length;
    }
    const files = [...paths];
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await supabaseAdmin.storage.from("photos").remove(files.slice(i, i + 100));
      if (error) throw new Error("Unable to remove account photos. Please try again.");
    }
    const { error: cleanupError } = await supabaseAdmin.rpc("delete_account_data", { p_user_id: userId });
    if (cleanupError) {
      console.error("Account cleanup failed", cleanupError.code);
      throw new Error("Unable to finish deleting account data. Please try again.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error("Account data removed, but account deletion needs another attempt. Please try again.");
    return { deleted: true };
  });