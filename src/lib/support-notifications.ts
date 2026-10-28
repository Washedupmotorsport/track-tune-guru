export type SupportSend = (
  template: string,
  email: string,
  options: { templateData: Record<string, unknown>; idempotencyKey: string; replyTo: string },
) => Promise<unknown>;

export type SupportReplyDelivery = "sent" | "suppressed" | "failed" | "not_required";

/** Only verified team replies are emailed, after the reply has been stored. */
export async function sendSupportReplyNotification(
  send: SupportSend,
  reply: { id: string; supportId: string; body: string },
  recipient: { email: string; name?: string | null },
  isStaffReply: boolean,
): Promise<SupportReplyDelivery> {
  if (!isStaffReply) return "not_required";
  try {
    const result = await send("support-reply", recipient.email, {
      templateData: { name: recipient.name ?? null, reference: reply.supportId, body: reply.body },
      idempotencyKey: `support-reply-${reply.id}`,
      replyTo: "support@myraceengineer.app",
    });
    return (result as { sent: boolean }).sent ? "sent" : "suppressed";
  } catch {
    return "failed";
  }
}

export async function sendSupportNotifications(
  send: SupportSend,
  id: string,
  input: { email: string; name?: string | null; category: string; message: string },
) {
  const notices = [
    {
      template: "support-message",
      email: "support@myraceengineer.app",
      replyTo: input.email,
      templateData: {
        siteName: "My Race Engineer", siteUrl: "https://myraceengineer.app",
        senderEmail: input.email, senderName: input.name ?? null,
        category: input.category, message: input.message, createdAt: new Date().toISOString(),
      },
    },
    {
      template: "support-confirmation",
      email: input.email,
      replyTo: "support@myraceengineer.app",
      templateData: { name: input.name ?? null, reference: id },
    },
  ];
  return Promise.allSettled(notices.map((notice) => send(notice.template, notice.email, {
    templateData: notice.templateData,
    idempotencyKey: `${notice.template}-${id}`,
    replyTo: notice.replyTo,
  })));
}

/** First load is a baseline, not a burst of alerts for old messages. */
export function newSupportMessageIds(previous: readonly string[] | null, current: readonly string[]) {
  if (previous === null) return [];
  const seen = new Set(previous);
  return current.filter((id) => !seen.has(id));
}