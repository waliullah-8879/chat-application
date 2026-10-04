class PresenceManager {
  private readonly socketsByUser = new Map<string, Set<string>>();

  connect(userId: string, socketId: string): boolean {
    const sockets = this.socketsByUser.get(userId) ?? new Set<string>();
    const wasOffline = sockets.size === 0;

    sockets.add(socketId);
    this.socketsByUser.set(userId, sockets);

    return wasOffline;
  }

  disconnect(userId: string, socketId: string): boolean {
    const sockets = this.socketsByUser.get(userId);

    if (!sockets) {
      return true;
    }

    sockets.delete(socketId);

    if (sockets.size === 0) {
      this.socketsByUser.delete(userId);
      return true;
    }

    return false;
  }

  isOnline(userId: string): boolean {
    return (this.socketsByUser.get(userId)?.size ?? 0) > 0;
  }
}

export const presenceManager = new PresenceManager();
