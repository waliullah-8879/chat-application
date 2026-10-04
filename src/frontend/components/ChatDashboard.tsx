import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConversationSummary, PublicUser } from "../../shared/types";
import { apiRequest } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { useSocket } from "../socket/SocketContext";
import { ChatPanel } from "./ChatPanel";
import { Sidebar } from "./Sidebar";
import { ChatInfoDrawer } from "./ChatInfoDrawer";
import { playPopSound } from "../utils/sound";

type ConversationsPayload = { conversations: ConversationSummary[] };
type UsersPayload = { users: PublicUser[] };
type DirectConversationPayload = { conversation: ConversationSummary };

export function ChatDashboard() {
  const { user, accessToken, logout } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageError, setPageError] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!accessToken) return;
    const response = await apiRequest<ConversationsPayload>("/api/conversations", {}, accessToken);
    if (response.success) {
      setConversations(response.data.conversations);
      // Auto-select first conversation if none selected yet on desktop
      if (!selectedId && response.data.conversations.length > 0 && window.innerWidth > 900) {
        setSelectedId(response.data.conversations[0]!.id);
      }
    }
  }, [accessToken, selectedId]);

  const loadUsers = useCallback(async () => {
    if (!accessToken) return;
    const response = await apiRequest<UsersPayload>("/api/users", {}, accessToken);
    if (response.success) setUsers(response.data.users);
  }, [accessToken]);

  useEffect(() => {
    void Promise.all([loadConversations(), loadUsers()]);
  }, [loadConversations, loadUsers]);

  useEffect(() => {
    if (!socket) return;

    const handleOnline = ({ userId }: { userId: string }) => {
      setUsers((current) => current.map((item) => item.id === userId ? { ...item, isOnline: true } : item));
      setConversations((current) => current.map((item) => item.otherUser.id === userId ? { ...item, otherUser: { ...item.otherUser, isOnline: true } } : item));
    };

    const handleOffline = ({ userId, lastSeenAt }: { userId: string; lastSeenAt: string }) => {
      setUsers((current) => current.map((item) => item.id === userId ? { ...item, isOnline: false, lastSeenAt } : item));
      setConversations((current) => current.map((item) => item.otherUser.id === userId ? { ...item, otherUser: { ...item.otherUser, isOnline: false, lastSeenAt } } : item));
    };

    const handleConversationUpdated = () => void loadConversations();

    socket.on("presence:online", handleOnline);
    socket.on("presence:offline", handleOffline);
    socket.on("conversation:updated", handleConversationUpdated);

    return () => {
      socket.off("presence:online", handleOnline);
      socket.off("presence:offline", handleOffline);
      socket.off("conversation:updated", handleConversationUpdated);
    };
  }, [socket, loadConversations]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(
      (item) =>
        item.otherUser.username.toLowerCase().includes(query) ||
        item.otherUser.email.toLowerCase().includes(query)
    );
  }, [conversations, search]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (item) =>
        item.username.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query)
    );
  }, [users, search]);

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedId) ?? null;

  async function startConversation(otherUser: PublicUser) {
    if (!accessToken) return;
    setPageError("");

    const existing = conversations.find((conversation) => conversation.otherUser.id === otherUser.id);
    if (existing) {
      setSelectedId(existing.id);
      return;
    }

    const response = await apiRequest<DirectConversationPayload>(
      "/api/conversations/direct",
      { method: "POST", body: JSON.stringify({ userId: otherUser.id }) },
      accessToken,
    );

    if (!response.success) {
      setPageError(response.message);
      return;
    }

    setConversations((current) => [response.data.conversation, ...current]);
    setSelectedId(response.data.conversation.id);
  }

  if (!user) return null;

  return (
    <main className={`app-shell ${isInfoOpen && selectedConversation ? "with-info-drawer" : ""}`}>
      {pageError && (
        <div className="global-error animate-slide-down">
          <span>{pageError}</span>
          <button onClick={() => setPageError("")}>×</button>
        </div>
      )}

      <Sidebar
        currentUser={user}
        conversations={filteredConversations}
        users={filteredUsers}
        selectedConversationId={selectedId}
        search={search}
        onSearchChange={setSearch}
        onSelectConversation={(conversation) => {
          setSelectedId(conversation.id);
        }}
        onStartConversation={startConversation}
        onLogout={() => void logout()}
        hiddenOnMobile={Boolean(selectedConversation)}
      />

      <ChatPanel
        conversation={selectedConversation}
        currentUser={user}
        onBack={() => setSelectedId(null)}
        onToggleInfo={() => setIsInfoOpen(!isInfoOpen)}
        isInfoOpen={isInfoOpen}
      />

      {isInfoOpen && selectedConversation && (
        <ChatInfoDrawer
          conversation={selectedConversation}
          onClose={() => {
            setIsInfoOpen(false);
            playPopSound();
          }}
          onSearchClick={() => {
            // Can trigger in-chat search
          }}
        />
      )}
    </main>
  );
}
