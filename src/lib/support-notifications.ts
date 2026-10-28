export type SupportSend = (
  template: string,
  email: string,
  options: { templateData: Record<string, unknown>; idempotencyKey: string; replyTo: string },
) => Promise<unknown>;

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