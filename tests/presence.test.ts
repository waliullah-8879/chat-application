import { describe, expect, it } from "vitest";
import { presenceManager } from "../src/backend/socket/presence.js";

describe("presence manager", () => {
  it("keeps a user online until their final socket disconnects", () => {
    const userId = "presence-test-user";

    expect(presenceManager.connect(userId, "socket-a")).toBe(true);
    expect(presenceManager.connect(userId, "socket-b")).toBe(false);
    expect(presenceManager.isOnline(userId)).toBe(true);

    expect(presenceManager.disconnect(userId, "socket-a")).toBe(false);
    expect(presenceManager.isOnline(userId)).toBe(true);

    expect(presenceManager.disconnect(userId, "socket-b")).toBe(true);
    expect(presenceManager.isOnline(userId)).toBe(false);
  });
});
