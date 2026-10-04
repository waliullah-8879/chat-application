import { useMemo } from "react";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", // Indigo to Purple
  "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)", // Blue to Cyan
  "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)", // Emerald to Teal
  "linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)", // Rose to Pink
  "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", // Amber to Orange
  "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)", // Violet to Pink
  "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)", // Sky to Indigo
  "linear-gradient(135deg, #10b981 0%, #84cc16 100%)", // Green to Lime
];

function getGradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index]!;
}

export function Avatar({
  name,
  online,
  size = "md",
  className = "",
}: {
  name: string;
  online?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const initials = useMemo(() => {
    return name
      .trim()
      .split(/[\s._-]+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";
  }, [name]);

  const background = useMemo(() => getGradientForName(name), [name]);

  return (
    <div
      className={`avatar avatar-${size} ${className}`}
      style={{ background }}
      aria-label={`${name}${online ? ", online" : ""}`}
    >
      <span className="avatar-text">{initials}</span>
      {online !== undefined && (
        <span className={`presence-dot ${online ? "online" : "offline"}`}>
          {online && <span className="presence-ping" />}
        </span>
      )}
    </div>
  );
}
