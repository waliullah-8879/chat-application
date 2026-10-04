import { useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import { 
  ArrowLeft, LoaderCircle, MessageCircle, Send, Wifi, WifiOff,
  Smile, Paperclip, Phone, Video, Info, Search, X, CheckCheck,
  Copy, Check, Reply, Sparkles, Mic, FileText, XCircle, Trash2,
  Download, Image as ImageIcon, FileArchive, Music, Volume2
} from "lucide-react";
import type { ChatMessage, ConversationSummary, PublicUser } from "../../shared/types";
import { apiRequest } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { useSocket } from "../socket/SocketContext";
import { Avatar } from "./Avatar";
import { EmojiPicker } from "./EmojiPicker";
import { AudioMessagePlayer } from "./AudioMessagePlayer";
import { uploadFileOrBlob } from "../api/upload";
import { playMessageSentSound, playMessageReceivedSound, playPopSound } from "../utils/sound";

type MessagesPayload = {
  messages: ChatMessage[];
  nextCursor: string | null;
};

export type StructuredMessage = 
  | { type: "text"; text: string }
  | { type: "audio"; file: { url: string; name: string; size: number; duration?: number } }
  | { type: "image"; text?: string; file: { url: string; name: string; size: number } }
  | { type: "file"; text?: string; file: { url: string; name: string; size: number; type?: string } };

export function parseMessageContent(raw: string): StructuredMessage {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.type) {
      return parsed as StructuredMessage;
    }
  } catch {
    // not json
  }
  return { type: "text", text: raw };
}

function formatMessageTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatLastSeen(dateString: string | null) {
  if (!dateString) return "Offline";
  const date = new Date(dateString);
  return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDateDivider(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function addMessageOnce(messages: ChatMessage[], incoming: ChatMessage) {
  if (messages.some((message) => message.id === incoming.id)) return messages;
  return [...messages, incoming];
}

const STARTER_PROMPTS = [
  "👋 Hey there! How are you doing today?",
  "☕ Quick catch-up? Let me know when you're free!",
  "🚀 Just checked the project update, looks awesome!",
  "💡 Working on the new designs, wanted your thoughts!",
];

export function ChatPanel({
  conversation,
  currentUser,
  onBack,
  onToggleInfo,
  isInfoOpen,
}: {
  conversation: ConversationSummary | null;
  currentUser: PublicUser;
  onBack: () => void;
  onToggleInfo?: () => void;
  isInfoOpen?: boolean;
}) {
  const { accessToken } = useAuth();
  const { socket, connectionState } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);

  // Attachment & Voice Recording state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  // Other UI states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string[]>>({});
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [callNotification, setCallNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimer = useRef<number | null>(null);
  const typingSent = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Clean up recording and previews on unmount or chat change
  useEffect(() => {
    cancelRecording();
    clearSelectedFile();
  }, [conversation?.id]);

  useEffect(() => {
    setMessages([]);
    setNextCursor(null);
    setDraft("");
    setError("");
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowSearchInChat(false);
    setChatSearchQuery("");
    setIsOtherUserTyping(false);
    typingSent.current = false;
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }

    if (!conversation || !accessToken) return;

    let cancelled = false;
    setIsLoading(true);

    void apiRequest<MessagesPayload>(
      `/api/conversations/${conversation.id}/messages?limit=30`,
      {},
      accessToken,
    ).then((response) => {
      if (cancelled) return;

      if (!response.success) {
        setError(response.message);
        return;
      }

      setMessages(response.data.messages);
      setNextCursor(response.data.nextCursor);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [conversation?.id, accessToken]);

  useEffect(() => {
    if (!conversation || !socket) return;

    const joinConversation = () => {
      socket.emit("conversation:join", { conversationId: conversation.id }, (response) => {
        if (!response.success) setError(response.message);
      });
    };

    if (socket.connected) joinConversation();
    socket.on("connect", joinConversation);

    return () => {
      socket.off("connect", joinConversation);
      if (socket.connected) {
        socket.emit("typing:stop", { conversationId: conversation.id });
        socket.emit("conversation:leave", { conversationId: conversation.id });
      }
    };
  }, [conversation?.id, socket]);

  useEffect(() => {
    if (!conversation || !socket) return;

    const handleNewMessage = (message: ChatMessage) => {
      if (message.conversationId !== conversation.id) return;
      setMessages((current) => addMessageOnce(current, message));
      setIsOtherUserTyping(false);

      if (message.senderId !== currentUser.id) {
        playMessageReceivedSound();
      }
    };

    const handleTypingStart = (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId === conversation.id && payload.userId !== currentUser.id) {
        setIsOtherUserTyping(true);
      }
    };

    const handleTypingStop = (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId === conversation.id && payload.userId !== currentUser.id) {
        setIsOtherUserTyping(false);
      }
    };

    socket.on("message:new", handleNewMessage);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [conversation?.id, socket, currentUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isOtherUserTyping]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, []);

  function stopTyping() {
    if (!conversation || !socket || !typingSent.current) return;
    socket.emit("typing:stop", { conversationId: conversation.id });
    typingSent.current = false;
  }

  function handleDraftChange(value: string) {
    setDraft(value);

    if (!conversation || !socket || !value.trim()) {
      stopTyping();
      return;
    }

    if (!typingSent.current) {
      socket.emit("typing:start", { conversationId: conversation.id });
      typingSent.current = true;
    }

    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(stopTyping, 1_100);
  }

  async function loadOlderMessages() {
    if (!conversation || !accessToken || !nextCursor || isLoadingOlder) return;

    setIsLoadingOlder(true);
    const response = await apiRequest<MessagesPayload>(
      `/api/conversations/${conversation.id}/messages?limit=30&cursor=${encodeURIComponent(nextCursor)}`,
      {},
      accessToken,
    );

    if (response.success) {
      setMessages((current) => [...response.data.messages, ...current]);
      setNextCursor(response.data.nextCursor);
    } else {
      setError(response.message);
    }

    setIsLoadingOlder(false);
  }

  // ==========================================
  // REAL VOICE MESSAGE RECORDING LOGIC
  // ==========================================
  async function startRecording() {
    if (isRecording || !conversation || !socket || isSending) return;
    setError("");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Audio recording is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // grab chunks every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);
      playPopSound();

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access failed", err);
      setError("Microphone permission denied. Please allow microphone access to record voice notes.");
    }
  }

  function cancelRecording() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
    playPopSound();
  }

  async function sendRecordedVoice() {
    if (!mediaRecorderRef.current || !conversation || !socket || !accessToken) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = recordingSeconds;
    setIsRecording(false);
    setIsSending(true);

    const recorder = mediaRecorderRef.current;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      if (recorder.state !== "inactive") {
        recorder.stop();
      } else {
        resolve();
      }
    });

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    const audioBlob = new Blob(audioChunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });

    if (audioBlob.size === 0) {
      setError("No audio was recorded.");
      setIsSending(false);
      return;
    }

    const audioFileName = `voice-${Date.now()}.webm`;
    const uploadRes = await uploadFileOrBlob(audioBlob, audioFileName, accessToken);

    if (!uploadRes.success) {
      setError(uploadRes.message);
      setIsSending(false);
      return;
    }

    const structuredPayload: StructuredMessage = {
      type: "audio",
      file: {
        url: uploadRes.data.url,
        name: audioFileName,
        size: uploadRes.data.size,
        duration: duration || 1,
      },
    };

    socket.emit(
      "message:send",
      {
        conversationId: conversation.id,
        content: JSON.stringify(structuredPayload),
        clientMessageId: crypto.randomUUID(),
      },
      (response) => {
        setIsSending(false);

        if (!response.success) {
          setError(response.message);
          return;
        }

        playMessageSentSound();
        setMessages((current) => addMessageOnce(current, response.data));
      },
    );
  }

  // ==========================================
  // REAL FILE ATTACHMENT LOGIC
  // ==========================================
  function handleFileClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError("File exceeds 25 MB size limit.");
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const preview = URL.createObjectURL(file);
      setFilePreviewUrl(preview);
    } else {
      setFilePreviewUrl(null);
    }
    playPopSound();
  }

  function clearSelectedFile() {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Other actions
  function handleSendPrompt(promptText: string) {
    setDraft(promptText);
    textareaRef.current?.focus();
  }

  function handleCopyMessage(id: string, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(id);
    playPopSound();
    setTimeout(() => setCopiedMessageId(null), 1800);
  }

  function handleToggleReaction(messageId: string, emoji: string) {
    playPopSound();
    setMessageReactions((prev) => {
      const current = prev[messageId] || [];
      const hasReaction = current.includes(emoji);
      const updated = hasReaction 
        ? current.filter((e) => e !== emoji)
        : [...current, emoji];
      return { ...prev, [messageId]: updated };
    });
  }

  function handleSimulateCall(type: "audio" | "video") {
    if (!conversation) return;
    playPopSound();
    setCallNotification(`Calling ${conversation.otherUser.username} (${type === "audio" ? "Voice" : "Video"} call)…`);
    setTimeout(() => setCallNotification(null), 3500);
  }

  function handleInsertEmoji(emoji: string) {
    setDraft((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
    playPopSound();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!conversation || !socket || isSending || !accessToken) return;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft && !selectedFile) return;

    setError("");
    setIsSending(true);
    stopTyping();

    try {
      let finalContent = "";

      if (selectedFile) {
        // Upload the actual file to /api/upload
        const uploadRes = await uploadFileOrBlob(selectedFile, selectedFile.name, accessToken);
        if (!uploadRes.success) {
          setError(uploadRes.message);
          setIsSending(false);
          return;
        }

        const isImage = selectedFile.type.startsWith("image/");
        const structured: StructuredMessage = isImage
          ? {
              type: "image",
              text: trimmedDraft || undefined,
              file: {
                url: uploadRes.data.url,
                name: uploadRes.data.name,
                size: uploadRes.data.size,
              },
            }
          : {
              type: "file",
              text: trimmedDraft || undefined,
              file: {
                url: uploadRes.data.url,
                name: uploadRes.data.name,
                size: uploadRes.data.size,
                type: selectedFile.type,
              },
            };

        finalContent = JSON.stringify(structured);
      } else {
        // Plain text or quote
        let text = trimmedDraft;
        if (replyingTo) {
          const parsedQuote = parseMessageContent(replyingTo.content);
          const quoteText = parsedQuote.type === "text" 
            ? parsedQuote.text 
            : `[${parsedQuote.type.toUpperCase()}] ${parsedQuote.file.name}`;
          text = `💬 Replying to: "${quoteText.slice(0, 35)}${quoteText.length > 35 ? "…" : ""}"\n${text}`;
        }
        finalContent = text;
      }

      setDraft("");
      clearSelectedFile();
      setReplyingTo(null);

      socket.emit(
        "message:send",
        {
          conversationId: conversation.id,
          content: finalContent,
          clientMessageId: crypto.randomUUID(),
        },
        (response) => {
          setIsSending(false);

          if (!response.success) {
            setError(response.message);
            return;
          }

          playMessageSentSound();
          setMessages((current) => addMessageOnce(current, response.data));
        },
      );
    } catch (err) {
      setIsSending(false);
      setError("Failed to send message.");
      console.error(err);
    }
  }

  // Filter messages if search is active
  const displayedMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return messages;
    const q = chatSearchQuery.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, chatSearchQuery]);

  if (!conversation) {
    return (
      <section className="chat-panel empty-chat">
        <div className="empty-chat-glow" />
        <div className="empty-chat-card">
          <div className="brand-mark-large-glow">
            <MessageCircle size={36} className="text-accent" />
          </div>
          <span className="empty-chat-badge">Nexus Workspace</span>
          <h2>Select a Conversation</h2>
          <p>
            Choose a contact from the sidebar or click any team member to start a secure,
            real-time chat session with voice notes and file sharing.
          </p>
          <div className="empty-chat-stats">
            <div>
              <strong>Instant</strong>
              <span>Sub-10ms WebSockets</span>
            </div>
            <div className="stat-divider" />
            <div>
              <strong>Encrypted</strong>
              <span>HMAC Signed Sessions</span>
            </div>
            <div className="stat-divider" />
            <div>
              <strong>Rich Media</strong>
              <span>Voice Notes & Files</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const { otherUser } = conversation;

  return (
    <section className="chat-panel">
      {/* Hidden file input for real attachments */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <div className="chat-ambient-glow" />

      {callNotification && (
        <div className="call-notification-banner animate-slide-down">
          <Sparkles size={16} />
          <span>{callNotification}</span>
        </div>
      )}

      <header className="chat-header">
        <button
          className="icon-button mobile-back"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft size={19} />
        </button>

        <Avatar name={otherUser.username} online={otherUser.isOnline} size="md" />

        <div className="chat-person">
          <div className="chat-person-name-row">
            <strong>{otherUser.username}</strong>
            {otherUser.isOnline && <span className="active-badge">Active</span>}
          </div>
          <span className="chat-person-status">
            {isOtherUserTyping ? (
              <span className="status-typing-text">typing a message…</span>
            ) : otherUser.isOnline ? (
              <span className="status-online-text">Online now</span>
            ) : (
              formatLastSeen(otherUser.lastSeenAt)
            )}
          </span>
        </div>

        <div className="chat-header-actions">
          <button
            className={`header-tool-btn ${showSearchInChat ? "active" : ""}`}
            onClick={() => {
              setShowSearchInChat(!showSearchInChat);
              playPopSound();
            }}
            title="Search in this conversation"
            aria-label="Search messages"
          >
            <Search size={17} />
          </button>

          <button
            className="header-tool-btn"
            onClick={() => handleSimulateCall("audio")}
            title="Start voice call"
            aria-label="Voice call"
          >
            <Phone size={17} />
          </button>

          <button
            className="header-tool-btn"
            onClick={() => handleSimulateCall("video")}
            title="Start video call"
            aria-label="Video call"
          >
            <Video size={17} />
          </button>

          {onToggleInfo && (
            <button
              className={`header-tool-btn info-btn ${isInfoOpen ? "active" : ""}`}
              onClick={() => {
                onToggleInfo();
                playPopSound();
              }}
              title="Toggle contact info"
              aria-label="Contact info"
            >
              <Info size={17} />
            </button>
          )}

          <div className={`connection-pill ${connectionState}`}>
            {connectionState === "connected" ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>{connectionState}</span>
          </div>
        </div>
      </header>

      {/* In-Chat Search Bar */}
      {showSearchInChat && (
        <div className="chat-search-bar animate-slide-down">
          <Search size={15} className="chat-search-icon" />
          <input
            type="text"
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            placeholder={`Search messages with ${otherUser.username}…`}
            autoFocus
          />
          {chatSearchQuery && (
            <button
              type="button"
              className="chat-search-clear"
              onClick={() => setChatSearchQuery("")}
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            className="chat-search-close"
            onClick={() => {
              setShowSearchInChat(false);
              setChatSearchQuery("");
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* Main Messages Stream Area */}
      <div className="messages-area">
        <div className="messages-stream-container">
          {nextCursor && (
            <div className="load-older-wrap">
              <button
                className="load-older-btn"
                onClick={loadOlderMessages}
                disabled={isLoadingOlder}
              >
                {isLoadingOlder ? <LoaderCircle className="spin" size={14} /> : null}
                <span>{isLoadingOlder ? "Retrieving history…" : "Load older messages"}</span>
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="messages-loading">
              <div className="loading-card">
                <LoaderCircle className="spin text-accent" size={28} />
                <span>Decrypting conversation…</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="conversation-welcome-card">
              <Avatar name={otherUser.username} online={otherUser.isOnline} size="xl" />
              <h3>Say hello to {otherUser.username} 👋</h3>
              <p>
                This is the start of your secure direct message channel with {otherUser.username}.
                Send text, voice recordings, photos, and files with instant delivery.
              </p>
              
              <div className="conversation-starter-prompts">
                <span className="starter-label">Suggestions to break the ice:</span>
                <div className="starter-chips">
                  {STARTER_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      className="starter-chip"
                      onClick={() => handleSendPrompt(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            displayedMessages.map((message, index) => {
              const mine = message.senderId === currentUser.id;
              const prevMessage = displayedMessages[index - 1];
              const showDateDivider =
                !prevMessage ||
                formatDateDivider(message.createdAt) !== formatDateDivider(prevMessage.createdAt);
              const reactions = messageReactions[message.id] || [];
              const parsed = parseMessageContent(message.content);

              return (
                <div key={message.id} className="message-cluster">
                  {showDateDivider && (
                    <div className="date-divider">
                      <span className="date-divider-pill">
                        {formatDateDivider(message.createdAt)}
                      </span>
                    </div>
                  )}

                  <div className={`message-row ${mine ? "mine" : "theirs"}`}>
                    {!mine && (
                      <Avatar
                        name={otherUser.username}
                        online={otherUser.isOnline}
                        size="sm"
                        className="message-avatar"
                      />
                    )}

                    <div className="message-bubble-wrapper">
                      <div className="message-bubble">
                        {/* 1. Voice Note Message */}
                        {parsed.type === "audio" && (
                          <div className="message-audio-container">
                            <AudioMessagePlayer
                              src={parsed.file.url}
                              duration={parsed.file.duration}
                              isMine={mine}
                            />
                          </div>
                        )}

                        {/* 2. Image Message */}
                        {parsed.type === "image" && (
                          <div className="message-image-container">
                            <a
                              href={parsed.file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="message-image-link"
                              title="Click to view full size"
                            >
                              <img
                                src={parsed.file.url}
                                alt={parsed.file.name}
                                className="message-inline-img"
                              />
                            </a>
                            {parsed.text && (
                              <p className="message-caption-text">{parsed.text}</p>
                            )}
                          </div>
                        )}

                        {/* 3. Document / File Message */}
                        {parsed.type === "file" && (
                          <div className="message-file-container">
                            <a
                              href={parsed.file.url}
                              download={parsed.file.name}
                              className="message-file-card"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <div className="file-card-icon-wrap">
                                <FileText size={22} />
                              </div>
                              <div className="file-card-details">
                                <strong className="file-card-name">{parsed.file.name}</strong>
                                <span className="file-card-size">
                                  {formatFileSize(parsed.file.size)}
                                </span>
                              </div>
                              <div className="file-card-download-btn">
                                <Download size={16} />
                              </div>
                            </a>
                            {parsed.text && (
                              <p className="message-caption-text">{parsed.text}</p>
                            )}
                          </div>
                        )}

                        {/* 4. Normal Plain Text */}
                        {parsed.type === "text" && (
                          <p className="message-text">{parsed.text}</p>
                        )}

                        <div className="message-meta-footer">
                          <time>{formatMessageTime(message.createdAt)}</time>
                          {mine && (
                            <span className="message-status-check">
                              <CheckCheck size={14} className="text-check-read" />
                            </span>
                          )}
                        </div>

                        {/* Hover Action Floating Bar */}
                        <div className="message-hover-actions">
                          <button
                            type="button"
                            className="msg-action-btn"
                            onClick={() => handleToggleReaction(message.id, "❤️")}
                            title="React with heart"
                          >
                            ❤️
                          </button>
                          <button
                            type="button"
                            className="msg-action-btn"
                            onClick={() => handleToggleReaction(message.id, "👍")}
                            title="React with thumbs up"
                          >
                            👍
                          </button>
                          <button
                            type="button"
                            className="msg-action-btn"
                            onClick={() => handleToggleReaction(message.id, "🔥")}
                            title="React with fire"
                          >
                            🔥
                          </button>
                          <button
                            type="button"
                            className="msg-action-btn"
                            onClick={() => handleCopyMessage(message.id, message.content)}
                            title="Copy message"
                          >
                            {copiedMessageId === message.id ? (
                              <Check size={14} className="text-success" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="msg-action-btn"
                            onClick={() => {
                              setReplyingTo(message);
                              textareaRef.current?.focus();
                            }}
                            title="Reply to message"
                          >
                            <Reply size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Reaction Badges Under Bubble */}
                      {reactions.length > 0 && (
                        <div className={`message-reactions-row ${mine ? "justify-end" : ""}`}>
                          {reactions.map((emoji, rIdx) => (
                            <button
                              key={rIdx}
                              type="button"
                              className="reaction-pill-badge"
                              onClick={() => handleToggleReaction(message.id, emoji)}
                              title="Click to remove reaction"
                            >
                              <span>{emoji}</span>
                              <span className="reaction-count">1</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isOtherUserTyping && (
            <div className="typing-row animate-fade-in">
              <Avatar name={otherUser.username} size="xs" />
              <div className="typing-bubble-card">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <small>{otherUser.username} is typing…</small>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Floating Composer Area */}
      <footer className="composer-area">
        {error && (
          <div className="chat-error-banner animate-shake" role="alert">
            <XCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Replying banner */}
        {replyingTo && (
          <div className="replying-preview-bar animate-slide-up">
            <Reply size={15} className="text-accent" />
            <div className="replying-copy">
              <strong>Replying to message:</strong>
              <p>
                {(() => {
                  const p = parseMessageContent(replyingTo.content);
                  return p.type === "text" ? p.text : `[${p.type.toUpperCase()}] ${p.file.name}`;
                })()}
              </p>
            </div>
            <button
              type="button"
              className="cancel-reply-btn"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* File attachment preview chip (REAL FILE) */}
        {selectedFile && (
          <div className="attachment-live-preview-card animate-slide-up">
            {filePreviewUrl ? (
              <img src={filePreviewUrl} alt="Preview" className="attachment-thumb" />
            ) : (
              <div className="attachment-icon-box">
                <FileText size={20} className="text-accent" />
              </div>
            )}
            <div className="attachment-meta">
              <strong className="attachment-filename">{selectedFile.name}</strong>
              <span className="attachment-filesize">{formatFileSize(selectedFile.size)}</span>
            </div>
            <button
              type="button"
              className="remove-attachment-btn"
              onClick={clearSelectedFile}
              aria-label="Remove attachment"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="composer-container">
          {showEmojiPicker && (
            <EmojiPicker
              onSelect={handleInsertEmoji}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}

          {/* ACTIVE RECORDING BAR */}
          {isRecording ? (
            <div className="recording-live-bar animate-slide-up">
              <div className="recording-status-col">
                <span className="recording-pulsing-dot" />
                <span className="recording-live-label">Recording Voice Message</span>
                <span className="recording-timer">
                  {Math.floor(recordingSeconds / 60)}:
                  {recordingSeconds % 60 < 10 ? "0" : ""}
                  {recordingSeconds % 60}
                </span>
              </div>

              <div className="recording-wave-bars">
                <span /><span /><span /><span /><span /><span />
              </div>

              <div className="recording-actions">
                <button
                  type="button"
                  className="recording-cancel-btn"
                  onClick={cancelRecording}
                  title="Discard recording"
                  aria-label="Cancel recording"
                >
                  <Trash2 size={18} />
                </button>

                <button
                  type="button"
                  className="recording-send-btn"
                  onClick={sendRecordedVoice}
                  title="Send voice message"
                  aria-label="Send voice message"
                  disabled={isSending}
                >
                  {isSending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
                </button>
              </div>
            </div>
          ) : (
            /* STANDARD TEXT/ATTACHMENT COMPOSER */
            <form className="composer-form" onSubmit={handleSubmit}>
              <div className="composer-left-tools">
                <button
                  type="button"
                  className={`composer-icon-btn ${showEmojiPicker ? "active" : ""}`}
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    playPopSound();
                  }}
                  title="Add emoji"
                  aria-label="Emoji picker"
                >
                  <Smile size={19} />
                </button>

                <button
                  type="button"
                  className={`composer-icon-btn ${selectedFile ? "active" : ""}`}
                  onClick={handleFileClick}
                  title="Attach file, photo or document"
                  aria-label="Attach file"
                >
                  <Paperclip size={19} />
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  selectedFile
                    ? "Add a caption… (or press Enter to send file)"
                    : connectionState === "connected"
                    ? `Message ${otherUser.username}… (Enter to send)`
                    : "Connecting to server…"
                }
                maxLength={2000}
                rows={1}
                disabled={connectionState !== "connected"}
              />

              <div className="composer-right-tools">
                <span className="char-counter">
                  {draft.length > 0 && `${draft.length}/2000`}
                </span>

                {/* REAL MICROPHONE RECORDING BUTTON */}
                <button
                  type="button"
                  className="composer-icon-btn mic-btn"
                  onClick={startRecording}
                  title="Record voice message (click to start)"
                  aria-label="Record voice message"
                >
                  <Mic size={18} />
                </button>

                <button
                  type="submit"
                  className={`send-button ${draft.trim() || selectedFile ? "ready" : ""}`}
                  disabled={(!draft.trim() && !selectedFile) || connectionState !== "connected" || isSending}
                  aria-label="Send message"
                  title="Send message (Enter)"
                >
                  {isSending ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Send size={18} className="send-icon" />
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="composer-footer-hint">
            <span>
              Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for a new line · Tap <strong>🎙️</strong> for voice notes
            </span>
          </div>
        </div>
      </footer>
    </section>
  );
}
