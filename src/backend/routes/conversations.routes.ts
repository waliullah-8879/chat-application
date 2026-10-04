import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { directConversationSchema, idSchema } from "../validators/chat.js";
import { serializeMessage, serializeUser } from "../utils/serializers.js";
import { presenceManager } from "../socket/presence.js";

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

conversationsRouter.get("/", async (req, res, next) => {
  try {
    const currentUserId = req.user!.sub;

    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId: currentUserId } } },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                avatarUrl: true,
                lastSeenAt: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    const data = conversations
      .map((conversation) => {
        const otherParticipant = conversation.participants.find(
          (participant) => participant.userId !== currentUserId,
        );

        if (!otherParticipant) {
          return null;
        }

        return {
          id: conversation.id,
          otherUser: serializeUser(
            otherParticipant.user,
            presenceManager.isOnline(otherParticipant.userId),
          ),
          lastMessage: conversation.messages[0]
            ? serializeMessage(conversation.messages[0])
            : null,
          updatedAt: conversation.updatedAt.toISOString(),
        };
      })
      .filter(Boolean);

    res.json({ success: true, data: { conversations: data } });
  } catch (error) {
    next(error);
  }
});

conversationsRouter.post("/direct", async (req, res, next) => {
  try {
    const parsed = directConversationSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, message: "A valid user ID is required." });
      return;
    }

    const currentUserId = req.user!.sub;
    const otherUserId = parsed.data.userId;

    if (currentUserId === otherUserId) {
      res.status(400).json({ success: false, message: "You cannot start a chat with yourself." });
      return;
    }

    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });

    if (!otherUser) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const directKey = [currentUserId, otherUserId].sort().join(":");

    const conversation = await prisma.conversation.upsert({
      where: { directKey },
      update: {},
      create: {
        directKey,
        participants: {
          create: [{ userId: currentUserId }, { userId: otherUserId }],
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          otherUser: serializeUser(otherUser, presenceManager.isOnline(otherUser.id)),
          lastMessage: null,
          updatedAt: conversation.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

conversationsRouter.get("/:conversationId/messages", async (req, res, next) => {
  try {
    const parsedConversationId = idSchema.safeParse(req.params.conversationId);

    if (!parsedConversationId.success) {
      res.status(400).json({ success: false, message: "Invalid conversation ID." });
      return;
    }

    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: parsedConversationId.data,
          userId: req.user!.sub,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ success: false, message: "You do not have access to this conversation." });
      return;
    }

    const rawLimit = Number(req.query.limit ?? 30);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 30;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const messages = await prisma.message.findMany({
      where: { conversationId: parsedConversationId.data },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1]!.id : null;

    res.json({
      success: true,
      data: {
        messages: messages.reverse().map(serializeMessage),
        nextCursor,
      },
    });
  } catch (error) {
    next(error);
  }
});
