import { z } from "zod";

export const idSchema = z.string().cuid();

export const directConversationSchema = z.object({
  userId: idSchema,
});

export const messageSchema = z.object({
  conversationId: idSchema,
  content: z.string().trim().min(1).max(50000),
  clientMessageId: z.string().uuid(),
});

export const roomSchema = z.object({
  conversationId: idSchema,
});
