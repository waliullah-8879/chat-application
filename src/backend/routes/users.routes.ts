import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { presenceManager } from "../socket/presence.js";
import { serializeUser } from "../utils/serializers.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get("/", async (req, res, next) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user!.sub },
        ...(search
          ? {
              OR: [
                { username: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { username: "asc" },
      take: 50,
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        lastSeenAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        users: users.map((user) => serializeUser(user, presenceManager.isOnline(user.id))),
      },
    });
  } catch (error) {
    next(error);
  }
});
