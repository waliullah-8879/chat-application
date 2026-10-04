import { useState } from "react";
import { 
  X, ShieldCheck, Bell, BellOff, Image, FileText, Link2, 
  Search, UserCheck, Calendar, Sparkles, Check
} from "lucide-react";
import type { ConversationSummary } from "../../shared/types";
import { Avatar } from "./Avatar";

export function ChatInfoDrawer({
  conversation,
  onClose,
  onSearchClick,
}: {
  conversation: ConversationSummary;
  onClose: () => void;
  onSearchClick: () => void;
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<"media" | "docs" | "links">("media");
  const [copied, setCopied] = useState(false);

  const { otherUser } = conversation;

  function copyEmail() {
    navigator.clipboard.writeText(otherUser.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <aside className="chat-info-drawer">
      <header className="info-drawer-header">
        <h3>Contact Info</h3>
        <button 
          className="icon-button close-btn" 
          onClick={onClose} 
          aria-label="Close details"
          title="Close details"
        >
          <X size={18} />
        </button>
      </header>

      <div className="info-drawer-scroll">
        <section className="info-profile-hero">
          <Avatar name={otherUser.username} online={otherUser.isOnline} size="xl" />
          <h2 className="info-profile-name">{otherUser.username}</h2>
          <button 
            type="button" 
            className="info-email-btn"
            onClick={copyEmail}
            title="Click to copy email"
          >
            <span>{otherUser.email}</span>
            {copied ? <Check size={13} className="text-success" /> : null}
          </button>
          
          <div className="info-status-pill">
            <span className={`status-indicator ${otherUser.isOnline ? "online" : "offline"}`} />
            <span>{otherUser.isOnline ? "Active now" : "Offline"}</span>
          </div>
        </section>

        <section className="info-quick-actions">
          <button 
            className="quick-action-item" 
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? "Unmute" : "Mute notifications"}
          >
            <div className={`action-icon-circle ${isMuted ? "muted" : ""}`}>
              {isMuted ? <BellOff size={18} /> : <Bell size={18} />}
            </div>
            <span>{isMuted ? "Muted" : "Mute"}</span>
          </button>

          <button 
            className="quick-action-item" 
            onClick={onSearchClick}
            title="Search in conversation"
          >
            <div className="action-icon-circle">
              <Search size={18} />
            </div>
            <span>Search</span>
          </button>

          <button 
            className="quick-action-item" 
            onClick={copyEmail}
            title="Copy user contact"
          >
            <div className="action-icon-circle">
              <UserCheck size={18} />
            </div>
            <span>{copied ? "Copied" : "Contact"}</span>
          </button>
        </section>

        <section className="info-security-card">
          <div className="security-icon-box">
            <ShieldCheck size={20} />
          </div>
          <div className="security-copy">
            <strong>Encrypted Channel</strong>
            <p>Direct communication via authenticated WebSocket handshake with HMAC sessions.</p>
          </div>
        </section>

        <section className="info-shared-section">
          <div className="shared-tabs">
            <button 
              className={`shared-tab ${activeTab === "media" ? "active" : ""}`}
              onClick={() => setActiveTab("media")}
            >
              <Image size={14} />
              <span>Media</span>
            </button>
            <button 
              className={`shared-tab ${activeTab === "docs" ? "active" : ""}`}
              onClick={() => setActiveTab("docs")}
            >
              <FileText size={14} />
              <span>Docs</span>
            </button>
            <button 
              className={`shared-tab ${activeTab === "links" ? "active" : ""}`}
              onClick={() => setActiveTab("links")}
            >
              <Link2 size={14} />
              <span>Links</span>
            </button>
          </div>

          <div className="shared-tab-content">
            {activeTab === "media" && (
              <div className="empty-shared-state">
                <Sparkles size={24} className="sparkle-icon" />
                <p>No photos or videos shared yet in this conversation</p>
              </div>
            )}
            {activeTab === "docs" && (
              <div className="empty-shared-state">
                <FileText size={24} className="sparkle-icon" />
                <p>No documents shared yet</p>
              </div>
            )}
            {activeTab === "links" && (
              <div className="empty-shared-state">
                <Link2 size={24} className="sparkle-icon" />
                <p>No links shared in this chat</p>
              </div>
            )}
          </div>
        </section>

        <section className="info-details-list">
          <div className="info-detail-row">
            <span className="detail-label">
              <Calendar size={14} /> Conversation Started
            </span>
            <span className="detail-value">
              {new Date(conversation.updatedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div className="info-detail-row">
            <span className="detail-label">
              <ShieldCheck size={14} /> Protocol
            </span>
            <span className="detail-value">WebSocket WSS + SQLite</span>
          </div>
        </section>
      </div>
    </aside>
  );
}
