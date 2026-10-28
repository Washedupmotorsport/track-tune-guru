import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AssignmentInput, ReadInboxInput, SupportReplyInput, TeamMessageInput, supportIsUnread } from "./inbox-rules";

export const getInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const [role, crew, direct, support, reads] = await Promise.all([
      db.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      db.rpc("inbox_crew_members"),
      db.from("team_messages").select("*").order("created_at", { ascending: false }).limit(200),
      db.from("support_messages").select("id,user_id,name,email,category,message,status,created_at,assigned_to").order("created_at", { ascending: false }).limit(200),
      db.from("support_inbox_reads").select("support_id,seen_at").eq("user_id", context.userId),
    ]);
    if (role.error || crew.error || direct.error || support.error || reads.error) throw new Error("Your inbox could not load. Please try again.");
    const supportIds = (support.data ?? []).map((row) => row.id);
    const replies = supportIds.length ? await db.from("support_replies").select("*").in("support_id", supportIds).order("created_at") : { data: [], error: null };
    if (replies.error) throw new Error("Your replies could not load. Please try again.");
    let staff: { id: string; display_name: string }[] = [];
    if (role.data) {
      // The support roster is only available after a verified support role check.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const roles = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
      if (roles.error) throw new Error("The support roster could not load.");
      const ids = (roles.data ?? []).map((row) => row.user_id);
      if (ids.length) {
        const profiles = await supabaseAdmin.from("profiles").select("id,display_name").in("id", ids);
        if (profiles.error) throw new Error("The support roster could not load.");
        staff = (profiles.data ?? []).map((p) => ({ id: p.id, display_name: p.display_name || "Support team member" }));
      }
    }
    const threads = (support.data ?? []).map((thread) => {
      const threadReplies = (replies.data ?? []).filter((reply) => reply.support_id === thread.id);
      const seen = reads.data?.find((row) => row.support_id === thread.id)?.seen_at;
      return { ...thread, replies: threadReplies, unread: supportIsUnread(thread, threadReplies, seen, context.userId) };
    });
    return { userId: context.userId, isAdmin: !!role.data, crew: crew.data ?? [], staff, direct: direct.data ?? [], support: threads };
  });

export const sendTeamMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TeamMessageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("team_messages").insert({ sender_id: context.userId, recipient_id: data.recipientId, body: data.body });
    if (error) throw new Error("Message not sent. Choose someone who shares a car with you.");
    return { ok: true };
  });

export const replyToSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SupportReplyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("support_replies").insert({ support_id: data.supportId, sender_id: context.userId, body: data.body });
    if (error) throw new Error("Your reply could not be sent. Please try again.");
    return { ok: true };
  });

export const assignSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AssignmentInput.parse(input))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("Only the support team can assign requests.");
    const { data: updated, error } = await context.supabase.from("support_messages").update({ assigned_to: data.assigneeId }).eq("id", data.supportId).select("id").single();
    if (error || !updated) throw new Error("That request could not be assigned.");
    return { ok: true };
  });

export const markInboxRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReadInboxInput.parse(input))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const result = data.kind === "team"
      ? await context.supabase.from("team_messages").update({ read_at: now }).eq("sender_id", data.id).eq("recipient_id", context.userId).is("read_at", null)
      : await context.supabase.from("support_inbox_reads").upsert({ user_id: context.userId, support_id: data.id, seen_at: now });
    if (result.error) throw new Error("Could not mark this conversation as read.");
    return { ok: true };
  });