import { useState, useMemo } from "react";
import { 
  LogOut, MessageSquare, Search, Users, X, Volume2, VolumeX,
  Sparkles, Plus, CheckCheck, CircleDot
} from "lucide-react";
import type { ConversationSummary, PublicUser } from "../../shared/types";
import { Avatar } from "./Avatar";
import { isSoundEnabled, setSoundEnabled, playPopSound } from "../utils/sound";

function previewTime(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

type SidebarProps = {
  currentUser: PublicUser;
  conversations: ConversationSummary[];
  users: PublicUser[];
  selectedConversationId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectConversation: (conversation: ConversationSummary) => void;
  onStartConversation: (user: PublicUser) => void;
  onLogout: () => void;
  hiddenOnMobile: boolean;
};

export function Sidebar({
  currentUser,
  conversations,
  users,
  selectedConversationId,
  search,
  onSearchChange,
  onSelectConversation,
  onStartConversation,
  onLogout,
  hiddenOnMobile,
}: SidebarProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "online" | "direct">("all");
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playPopSound();
  }

  const conversationUserIds = useMemo(
    () => new Set(conversations.map((c) => c.otherUser.id)),
    [conversations]
  );
  
  const availableUsers = useMemo(
    () => users.filter((u) => !conversationUserIds.has(u.id)),
    [users, conversationUserIds]
  );

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      if (activeFilter === "online") {
        return conversation.otherUser.isOnline;
      }
      return true;
    });
  }, [conversations, activeFilter]);

  const onlineCount = useMemo(
    () => conversations.filter((c) => c.otherUser.isOnline).length + users.filter((u) => u.isOnline).length,
    [conversations, users]
  );

  return (
    <aside className={`sidebar ${hiddenOnMobile ? "mobile-hidden" : ""}`}>
      <header className="sidebar-header">
        <div className="brand-row">
          <div className="brand-mark-glow">
            <MessageSquare size={20} className="brand-icon" />
          </div>
          <div className="brand-text-col">
            <div className="brand-title-wrap">
              <strong>Nexus</strong>
              <span className="brand-badge">PRO</span>
            </div>
            <span className="brand-subtitle">Real-time Workspace</span>
          </div>
        </div>

        <div className="sidebar-actions">
          <button
            className={`icon-button sound-btn ${soundOn ? "active" : ""}`}
            onClick={toggleSound}
            title={soundOn ? "Mute notification sounds" : "Enable notification sounds"}
            aria-label="Toggle sound"
          >
            {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button
            className="icon-button logout-btn"
            onClick={onLogout}
            title="Sign out of workspace"
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <div className="search-section">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search conversations & people…"
            aria-label="Search people and chats"
          />
          {search ? (
            <button 
              type="button" 
              className="clear-search-btn" 
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : (
            <span className="shortcut-hint">Ctrl K</span>
          )}
        </div>

        <div className="sidebar-filter-tabs">
          <button
            type="button"
            className={`filter-pill ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            All Chats
            <span className="pill-count">{conversations.length}</span>
          </button>
          <button
            type="button"
            className={`filter-pill ${activeFilter === "online" ? "active" : ""}`}
            onClick={() => setActiveFilter("online")}
          >
            <span className="online-indicator-dot" />
            Online
            <span className="pill-count">{onlineCount}</span>
          </button>
        </div>
      </div>

      <div className="sidebar-scroll">
        <section className="sidebar-section">
          <div className="section-title">
            <span className="section-title-left">
              <CircleDot size={13} />
              <span>Conversations</span>
            </span>
            <span className="section-badge">{filteredConversations.length}</span>
          </div>

          {filteredConversations.length === 0 ? (
            <div className="sidebar-empty">
              <Sparkles size={20} className="empty-sparkle" />
              <p>
                {activeFilter === "online"
                  ? "None of your contacts are online right now."
                  : search
                  ? "No matching conversations found."
                  : "No conversations yet. Choose someone below to start chatting!"}
              </p>
            </div>
          ) : (
            <div className="conversations-list">
              {filteredConversations.map((conversation) => {
                const isSelected = selectedConversationId === conversation.id;
                const other = conversation.otherUser;
                const isSentByMe = conversation.lastMessage?.senderId === currentUser.id;

                return (
                  <button
                    className={`conversation-row ${isSelected ? "active" : ""}`}
                    key={conversation.id}
                    onClick={() => {
                      onSelectConversation(conversation);
                      playPopSound();
                    }}
                  >
                    <Avatar name={other.username} online={other.isOnline} size="md" />
                    <div className="conversation-copy">
                      <div className="conversation-topline">
                        <span className="contact-name">{other.username}</span>
                        <time className="conversation-time">
                          {previewTime(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}
                        </time>
                      </div>
                      <div className="conversation-preview-row">
                        {isSentByMe && <CheckCheck size={14} className="preview-check text-accent" />}
                        <p className="conversation-preview">
                          {conversation.lastMessage?.content ?? "New conversation started"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {availableUsers.length > 0 && (
          <section className="sidebar-section contacts-section">
            <div className="section-title">
              <span className="section-title-left">
                <Users size={13} />
                <span>People & Team</span>
              </span>
              <span className="section-badge">{availableUsers.length}</span>
            </div>

            <div className="contacts-list">
              {availableUsers.map((user) => (
                <button
                  className="contact-row"
                  key={user.id}
                  onClick={() => {
                    onStartConversation(user);
                    playPopSound();
                  }}
                  title={`Start chatting with ${user.username}`}
                >
                  <Avatar name={user.username} online={user.isOnline} size="sm" />
                  <div className="contact-info">
                    <strong className="contact-name">{user.username}</strong>
                    <span className="contact-status-text">
                      {user.isOnline ? "Active now" : "Offline"}
                    </span>
                  </div>
                  <div className="start-chat-icon">
                    <Plus size={15} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="profile-bar">
        <Avatar name={currentUser.username} online size="md" />
        <div className="profile-details">
          <strong className="profile-name">{currentUser.username}</strong>
          <span className="profile-email">{currentUser.email}</span>
        </div>
        <div className="online-pill-tag">
          <span className="status-dot-pulse" />
          <span>Active</span>
        </div>
      </footer>
    </aside>
  );
}
