import { z } from "zod";

export const InboxBody = z
  .string()
  .trim()
  .min(1, "Enter a message")
  .max(4000, "Keep your message under 4000 characters");
export const TeamMessageInput = z.object({ recipientId: z.string().uuid(), body: InboxBody });
export const SupportReplyInput = z.object({ supportId: z.string().uuid(), body: InboxBody });
export const AssignmentInput = z.object({
  supportId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable(),
});
export const ReadInboxInput = z.object({
  kind: z.enum(["team", "support"]),
  id: z.string().uuid(),
});

export function supportIsUnread(
  thread: { created_at: string; user_id: string | null },
  replies: { sender_id: string; created_at: string }[],
  seenAt: string | undefined,
  userId: string,
) {
  const incoming = replies
    .filter((reply) => reply.sender_id !== userId)
    .map((reply) => reply.created_at);
  if (thread.user_id !== userId) incoming.push(thread.created_at);
  return incoming.some((at) => !seenAt || Date.parse(at) > Date.parse(seenAt));
}
