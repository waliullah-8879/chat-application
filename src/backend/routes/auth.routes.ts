import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { authRateLimit } from "../middleware/rateLimits.js";
import { requireAuth } from "../middleware/auth.js";
import { loginSchema, registerSchema } from "../validators/auth.js";
import { createAccessToken } from "../utils/jwt.js";
import { createOpaqueToken, hashToken } from "../utils/tokens.js";
import { serializeUser } from "../utils/serializers.js";

export const authRouter = Router();
const refreshCookieName = "nexus_refresh";

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/auth",
    maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  };
}

async function createSession(user: { id: string; email: string; username: string }) {
  const accessToken = createAccessToken({
    sub: user.id,
    email: user.email,
    username: user.username,
  });

  const refreshToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}

authRouter.post("/register", authRateLimit, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid registration data.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, env.BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        email: parsed.data.email,
        passwordHash,
      },
    });

    const session = await createSession(user);
    res.cookie(refreshCookieName, session.refreshToken, refreshCookieOptions());

    res.status(201).json({
      success: true,
      data: {
        accessToken: session.accessToken,
        user: serializeUser(user),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ success: false, message: "That email or username is already in use." });
      return;
    }

    next(error);
  }
});

authRouter.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Enter a valid email and password." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    const passwordMatches = user
      ? await bcrypt.compare(parsed.data.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      res.status(401).json({ success: false, message: "Incorrect email or password." });
      return;
    }

    const session = await createSession(user);
    res.cookie(refreshCookieName, session.refreshToken, refreshCookieOptions());

    res.json({
      success: true,
      data: {
        accessToken: session.accessToken,
        user: serializeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", authRateLimit, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[refreshCookieName] as string | undefined;

    if (!refreshToken) {
      res.status(401).json({ success: false, message: "No refresh session was found." });
      return;
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt <= new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      }

      res.clearCookie(refreshCookieName, { ...refreshCookieOptions(), maxAge: undefined });
      res.status(401).json({ success: false, message: "Your session has expired." });
      return;
    }

    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const session = await createSession(storedToken.user);
    res.cookie(refreshCookieName, session.refreshToken, refreshCookieOptions());

    res.json({
      success: true,
      data: {
        accessToken: session.accessToken,
        user: serializeUser(storedToken.user),
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[refreshCookieName] as string | undefined;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
    }

    res.clearCookie(refreshCookieName, { ...refreshCookieOptions(), maxAge: undefined });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });

    if (!user) {
      res.status(404).json({ success: false, message: "User account not found." });
      return;
    }

    res.json({ success: true, data: { user: serializeUser(user) } });
  } catch (error) {
    next(error);
  }
});
