import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AuthedSupportMessageInput,
  SUPPORT_DAILY_LIMIT,
  SupportMessageInput,
  SupportStatusInput,
} from "./launch-rules";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

type StoredMessage = {
  email: string;
  name?: string | null;
  category: string;
  message: string;
  source: string;
  honeypot?: string;
};

/**
 * Inserts one support message, then copies it to the support mailbox.
 * The insert is the durable part: a failed send never loses the message.
 */
async function storeMessage(
  admin: AdminClient,
  input: StoredMessage,
  userId: string | null,
): Promise<{ ok: true }> {
  // Hidden field filled in by a bot: report success without storing anything.
  if (input.honeypot && input.honeypot.trim().length > 0) return { ok: true };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("email", input.email)
    .gte("created_at", since);
  if (countError) throw new Error("We could not check your recent messages. Please try again.");
  if ((count ?? 0) >= SUPPORT_DAILY_LIMIT) {
    throw new Error(
      `You have already sent ${SUPPORT_DAILY_LIMIT} messages in the last day. We have them all — please try again tomorrow.`,
    );
  }

  const { data, error } = await admin
    .from("support_messages")
    .insert({
      user_id: userId,
      email: input.email,
      name: input.name ?? null,
      category: input.category,
      message: input.message,
      source: input.source,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Your message did not reach us. Please try again.");

  try {
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("support-message", input.email, {
      templateData: {
        siteName: "My Race Engineer",
        siteUrl: "https://myraceengineer.app",
        senderEmail: input.email,
        senderName: input.name ?? null,
        category: input.category,
        message: input.message,
        createdAt: new Date().toISOString(),
      },
      idempotencyKey: `support-message-${data.id}`,
      replyTo: input.email,
    });
  } catch (sendError) {
    console.error("Support mailbox notification failed", (sendError as Error).message);
  }

  return { ok: true };
}

export const submitSupportMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SupportMessageInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return storeMessage(supabaseAdmin, data, null);
  });

export const submitSupportMessageSignedIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AuthedSupportMessageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.auth.getUser();
    const email = profile.user?.email;
    if (!email) throw new Error("We could not confirm your email address. Please use the support page.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return storeMessage(supabaseAdmin, { ...data, email }, context.userId);
  });

export const listSupportMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only the My Race Engineer team can open the support inbox.");
    const { data, error } = await context.supabase
      .from("support_messages")
      .select("id, created_at, email, name, category, message, status, resolved_at, source, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("We could not load the support inbox. Please try again.");
    return data;
  });

export const setSupportMessageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SupportStatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only the My Race Engineer team can update support messages.");
    const { error } = await context.supabase
      .from("support_messages")
      .update({
        status: data.status,
        resolved_at: data.status === "resolved" ? new Date().toISOString() : null,
        resolved_by: data.status === "resolved" ? context.userId : null,
      })
      .eq("id", data.id);
    if (error) throw new Error("That message could not be updated. Please try again.");
    return { ok: true };
  });
