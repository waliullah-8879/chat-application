import { describe, expect, it } from "vitest";
import { registerSchema } from "../src/backend/validators/auth.js";
import { messageSchema } from "../src/backend/validators/chat.js";

describe("security validation", () => {
  it("rejects weak registration passwords", () => {
    const result = registerSchema.safeParse({
      username: "demo-user",
      email: "demo@example.com",
      password: "password",
    });

    expect(result.success).toBe(false);
  });

  it("rejects oversized messages", () => {
    const result = messageSchema.safeParse({
      conversationId: "cm12345678901234567890123",
      content: "x".repeat(2001),
      clientMessageId: "2f6f5b19-94a3-4dcb-87eb-9da30bb56db3",
    });

    expect(result.success).toBe(false);
  });
});
