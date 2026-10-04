import { useEffect, useRef, useState } from "react";
import { Smile, Heart, ThumbsUp, Sparkles, Coffee } from "lucide-react";

const EMOJI_CATEGORIES = [
  {
    id: "reactions",
    label: "Reactions",
    icon: Sparkles,
    emojis: ["👍", "❤️", "🔥", "😂", "🎉", "👏", "🚀", "✨", "💯", "🙏", "👀", "🙌"],
  },
  {
    id: "smileys",
    label: "Smileys",
    icon: Smile,
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😋", "😛", "😜", "🤪", "😝",
      "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒",
      "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢",
      "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐",
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    icon: ThumbsUp,
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟",
      "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊",
      "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪",
    ],
  },
  {
    id: "hearts",
    label: "Hearts & Fun",
    icon: Heart,
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌", "💤", "💬", "💭", "💥",
    ],
  },
  {
    id: "lifestyle",
    label: "Work & Vibe",
    icon: Coffee,
    emojis: [
      "☕", "💻", "⚡", "🎯", "💡", "🛠️", "🚀", "⭐", "🌟", "✨", "🏆", "🎖️",
      "🎧", "🎮", "🍕", "🍔", "🍻", "🎉", "🎈", "🎁", "🔥", "🌈", "☀️", "🌙",
    ],
  },
];

export function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState("reactions");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeCategory) || EMOJI_CATEGORIES[0]!;

  return (
    <div className="emoji-picker-popover" ref={popoverRef}>
      <div className="emoji-picker-tabs">
        {EMOJI_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              className={`emoji-tab-btn ${activeCategory === cat.id ? "active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
              title={cat.label}
              aria-label={cat.label}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      <div className="emoji-category-header">
        <span>{currentCategory.label}</span>
      </div>

      <div className="emoji-grid">
        {currentCategory.emojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            className="emoji-item-btn"
            onClick={() => {
              onSelect(emoji);
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
