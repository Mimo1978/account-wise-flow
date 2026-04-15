import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const SEARCH_MESSAGES = [
  "Scanning profiles...",
  "Weighing company prestige...",
  "Analysing tenure patterns...",
  "Checking skill alignment...",
  "Ranking top matches...",
];

const GENERAL_MESSAGES = [
  "Loading...",
  "Fetching data...",
  "Almost there...",
];

/* ── Orbital nodes — full section loader ── */
export function CMOrbital({
  size = 80,
  messages = GENERAL_MESSAGES,
  className,
}: {
  size?: number;
  messages?: string[];
  className?: string;
}) {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => setMsgIdx(i => (i + 1) % messages.length), 2000);
    return () => clearInterval(t);
  }, [messages.length]);

  const c = size / 2;
  const r1 = size * 0.27;
  const r2 = size * 0.43;
  const r3 = size * 0.48;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Centre */}
        <div className="absolute rounded-full bg-primary" style={{ width: 6, height: 6, top: c - 3, left: c - 3 }} />

        {/* Ring 1 */}
        <div className="absolute inset-0" style={{ animation: "cmOrb 2s linear infinite" }}>
          <div className="absolute rounded-full bg-primary/80" style={{ width: 5, height: 5, top: c - r1 - 2.5, left: c - 2.5 }} />
        </div>

        {/* Ring 2 */}
        <div className="absolute inset-0" style={{ animation: "cmOrb 3.5s linear infinite reverse" }}>
          <div className="absolute rounded-full bg-primary/60" style={{ width: 4, height: 4, top: c - r2 - 2, left: c - 2 }} />
          <div className="absolute rounded-full bg-primary/40" style={{ width: 4, height: 4, top: c + r2 - 2, left: c - 2 }} />
        </div>

        {/* Ring 3 */}
        <div className="absolute inset-0" style={{ animation: "cmOrb 5s linear infinite" }}>
          <div className="absolute rounded-full bg-primary/30" style={{ width: 3, height: 3, top: c - r3 - 1.5, left: c - 1.5 }} />
        </div>
      </div>

      {messages.length > 0 && (
        <span className="text-xs text-muted-foreground font-medium animate-fade-in">
          {messages[msgIdx]}
        </span>
      )}
      <style>{`@keyframes cmOrb{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ── Pipeline pulse — inline/button loader ── */
export function CMPulse({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const heights = size === "sm"
    ? [4, 7, 10, 7, 4]
    : size === "lg"
    ? [8, 14, 20, 16, 20, 10, 18, 8]
    : [6, 10, 14, 10, 14, 8, 12, 6];
  const h = size === "sm" ? 10 : size === "lg" ? 20 : 14;
  return (
    <div className="flex items-end gap-[2px]" style={{ height: h }}>
      {heights.map((bh, i) => (
        <div key={i} className="w-[2px] rounded-full bg-primary/70" style={{ height: bh, animation: `cmPulse 0.8s ease-in-out ${i * 80}ms infinite alternate` }} />
      ))}
      <style>{`@keyframes cmPulse{from{opacity:.25;transform:scaleY(.5)}to{opacity:1;transform:scaleY(1)}}`}</style>
    </div>
  );
}

/* ── Full page orbital overlay ── */
export function CMOrbitalOverlay({
  visible,
  title = "Processing...",
  subtitle = "This won't take long",
  messages,
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
  messages?: string[];
}) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <CMOrbital size={100} messages={messages} />
      <div className="mt-6 text-center">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

/* ── Section loader — replaces centred Loader2 in page sections ── */
export function CMSectionLoader({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <CMOrbital size={48} messages={message ? [message] : GENERAL_MESSAGES} />
    </div>
  );
}
