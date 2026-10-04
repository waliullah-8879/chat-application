import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  username: string;
};

export type VerifiedAccessTokenPayload = AccessTokenPayload & {
  iat: number;
  exp: number;
};

export function createAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"],
    issuer: "nexus-chat",
    audience: "nexus-chat-user",
  });
}

export function verifyAccessToken(token: string): VerifiedAccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: "nexus-chat",
    audience: "nexus-chat-user",
  }) as VerifiedAccessTokenPayload;
}
