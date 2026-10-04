import type { Server as HttpServer } from "node:http";
import { Prisma } from "@prisma/client";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/types.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { serializeMessage } from "../utils/serializers.js";
import { messageSchema, roomSchema } from "../validators/chat.js";
import { presenceManager } from "./presence.js";

type SocketData = {
  userId: string;
  authExpiresAt: number;
  authorizedConversations: Set<string>;
  messageTimestamps: number[];
  typingTimestamps: number[];
};

type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function exceedsRateLimit(timestamps: number[], limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= limit) return true;
  timestamps.push(now);
  return false;
}

async function canAccessConversation(conversationId: string, userId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } },
    },
    include: { participants: true },
  });
}

export function createSocketServer(httpServer: HttpServer): ChatServer {
  const io: ChatServer = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    },
    maxHttpBufferSize: 1_000_000,
    pingTimeout: 20_000,
    pingInterval: 25_000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (typeof token !== "string" || token.length === 0) {
        next(new Error("Authentication required."));
        return;
      }

      const payload = verifyAccessToken(token);
      const userExists = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });

      if (!userExists) {
        next(new Error("User account no longer exists."));
        return;
      }

      socket.data.userId = payload.sub;
      socket.data.authExpiresAt = payload.exp * 1000;
      socket.data.authorizedConversations = new Set<string>();
      socket.data.messageTimestamps = [];
      socket.data.typingTimestamps = [];
      next();
    } catch {
      next(new Error("Invalid or expired authentication token."));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.join(userRoom(userId));

    const authLifetimeMs = Math.max(socket.data.authExpiresAt - Date.now(), 0);
    const authExpiryTimer = setTimeout(() => {
      socket.disconnect(true);
    }, authLifetimeMs);

    const firstConnection = presenceManager.connect(userId, socket.id);
    if (firstConnection) {
      io.emit("presence:online", { userId });
    }

    socket.on("conversation:join", async (payload, ack) => {
      const parsed = roomSchema.safeParse(payload);

      if (!parsed.success) {
        ack({ success: false, message: "Invalid conversation." });
        return;
      }

      const conversation = await canAccessConversation(parsed.data.conversationId, userId);

      if (!conversation) {
        ack({ success: false, message: "You are not allowed to join this conversation." });
        return;
      }

      socket.data.authorizedConversations.add(conversation.id);
      await socket.join(conversationRoom(conversation.id));
      ack({ success: true, data: { conversationId: conversation.id } });
    });

    socket.on("conversation:leave", async (payload) => {
      const parsed = roomSchema.safeParse(payload);
      if (!parsed.success) return;

      socket.data.authorizedConversations.delete(parsed.data.conversationId);
      await socket.leave(conversationRoom(parsed.data.conversationId));
    });

    socket.on("message:send", async (payload, ack) => {
      if (exceedsRateLimit(socket.data.messageTimestamps, 12, 5_000)) {
        ack({ success: false, message: "You are sending messages too quickly." });
        return;
      }

      const parsed = messageSchema.safeParse(payload);

      if (!parsed.success) {
        ack({
          success: false,
          message: parsed.error.issues[0]?.message ?? "Invalid message payload.",
        });
        return;
      }

      try {
        const conversation = await canAccessConversation(parsed.data.conversationId, userId);

        if (!conversation) {
          ack({ success: false, message: "You cannot send messages to this conversation." });
          return;
        }

        const receiver = conversation.participants.find(
          (participant) => participant.userId !== userId,
        );

        if (!receiver) {
          ack({ success: false, message: "Message receiver could not be determined." });
          return;
        }

        const message = await prisma.$transaction(async (tx) => {
          const createdMessage = await tx.message.create({
            data: {
              conversationId: conversation.id,
              senderId: userId,
              receiverId: receiver.userId,
              content: parsed.data.content,
              clientMessageId: parsed.data.clientMessageId,
            },
          });

          await tx.conversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });

          return createdMessage;
        });

        const outgoingMessage = serializeMessage(message);

        io.to(conversationRoom(conversation.id))
          .to(userRoom(userId))
          .to(userRoom(receiver.userId))
          .emit("message:new", outgoingMessage);

        io.to(userRoom(userId))
          .to(userRoom(receiver.userId))
          .emit("conversation:updated", { conversationId: conversation.id });

        ack({ success: true, data: outgoingMessage });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const existing = await prisma.message.findFirst({
            where: {
              senderId: userId,
              clientMessageId: parsed.data.clientMessageId,
            },
          });

          if (existing) {
            ack({ success: true, data: serializeMessage(existing) });
            return;
          }
        }

        console.error("message:send failed", error);
        ack({ success: false, message: "The message could not be sent." });
      }
    });

    socket.on("typing:start", (payload) => {
      if (exceedsRateLimit(socket.data.typingTimestamps, 20, 10_000)) return;

      const parsed = roomSchema.safeParse(payload);
      if (!parsed.success) return;

      if (!socket.data.authorizedConversations.has(parsed.data.conversationId)) return;

      socket.to(conversationRoom(parsed.data.conversationId)).emit("typing:start", {
        conversationId: parsed.data.conversationId,
        userId,
      });
    });

    socket.on("typing:stop", (payload) => {
      const parsed = roomSchema.safeParse(payload);
      if (!parsed.success) return;

      if (!socket.data.authorizedConversations.has(parsed.data.conversationId)) return;

      socket.to(conversationRoom(parsed.data.conversationId)).emit("typing:stop", {
        conversationId: parsed.data.conversationId,
        userId,
      });
    });

    socket.on("disconnecting", () => {
      for (const conversationId of socket.data.authorizedConversations) {
        socket.to(conversationRoom(conversationId)).emit("typing:stop", {
          conversationId,
          userId,
        });
      }
    });

    socket.on("disconnect", async () => {
      clearTimeout(authExpiryTimer);
      const isNowOffline = presenceManager.disconnect(userId, socket.id);

      if (!isNowOffline) return;

      const lastSeenAt = new Date();

      try {
        await prisma.user.update({
          where: { id: userId },
          data: { lastSeenAt },
        });
      } catch (error) {
        console.error("Failed to update last seen time", error);
      }

      io.emit("presence:offline", {
        userId,
        lastSeenAt: lastSeenAt.toISOString(),
      });
    });
  });

  return io;
}
