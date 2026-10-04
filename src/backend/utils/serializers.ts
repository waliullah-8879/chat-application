import type { Message, User } from "@prisma/client";
import type { ChatMessage, PublicUser } from "../../shared/types.js";

export function serializeUser(
  user: Pick<User, "id" | "username" | "email" | "avatarUrl" | "lastSeenAt">,
  isOnline?: boolean,
): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    ...(isOnline === undefined ? {} : { isOnline }),
  };
}

export function serializeMessage(message: Message): ChatMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    receiverId: message.receiverId,
    content: message.content,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
  };
}
