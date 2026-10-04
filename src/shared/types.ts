export type PublicUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  isOnline?: boolean;
  lastSeenAt: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  clientMessageId: string | null;
  createdAt: string;
  readAt: string | null;
};

export type ConversationSummary = {
  id: string;
  otherUser: PublicUser;
  lastMessage: ChatMessage | null;
  updatedAt: string;
};

export type Ack<T = undefined> =
  | { success: true; data: T }
  | { success: false; message: string };

export type ClientToServerEvents = {
  "conversation:join": (
    payload: { conversationId: string },
    ack: (response: Ack<{ conversationId: string }>) => void,
  ) => void;
  "conversation:leave": (payload: { conversationId: string }) => void;
  "message:send": (
    payload: { conversationId: string; content: string; clientMessageId: string },
    ack: (response: Ack<ChatMessage>) => void,
  ) => void;
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
};

export type ServerToClientEvents = {
  "message:new": (message: ChatMessage) => void;
  "typing:start": (payload: { conversationId: string; userId: string }) => void;
  "typing:stop": (payload: { conversationId: string; userId: string }) => void;
  "presence:online": (payload: { userId: string }) => void;
  "presence:offline": (payload: { userId: string; lastSeenAt: string }) => void;
  "conversation:updated": (payload: { conversationId: string }) => void;
};
