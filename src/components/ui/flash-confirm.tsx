import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type FlashType = "success" | "error" | "warning" | "info";

interface FlashMessage {
  id: string;
  message: string;
  description?: string;
  type: FlashType;
}

const listeners: Array<(msg: FlashMessage) => void> = [];

export function flashConfirm(
  message: string,
  type: FlashType = "success",
  description?: string
) {
  const msg: FlashMessage = {
    id: Math.random().toString(36).slice(2),
    message,
    description,
    type,
  };
  listeners.forEach((fn) => fn(msg));
}

const CONFIG = {
  success: {
    icon: CheckCircle2,
    ring: "rgba(52,211,153,0.6)",
    bg: "rgba(6,40,30,0.97)",
    border: "rgba(52,211,153,0.4)",
    iconColor: "#34d399",
    glow: "0 0 80px rgba(52,211,153,0.3), 0 20px 60px rgba(0,0,0,0.7)",
  },
  error: {
    icon: XCircle,
    ring: "rgba(248,113,113,0.6)",
    bg: "rgba(60,10,10,0.97)",
    border: "rgba(248,113,113,0.4)",
    iconColor: "#f87171",
    glow: "0 0 80px rgba(248,113,113,0.3), 0 20px 60px rgba(0,0,0,0.7)",
  },
  warning: {
    icon: AlertTriangle,
    ring: "rgba(251,191,36,0.6)",
    bg: "rgba(50,30,0,0.97)",
    border: "rgba(251,191,36,0.4)",
    iconColor: "#fbbf24",
    glow: "0 0 80px rgba(251,191,36,0.3), 0 20px 60px rgba(0,0,0,0.7)",
  },
  info: {
    icon: Info,
    ring: "rgba(99,102,241,0.6)",
    bg: "rgba(15,10,50,0.97)",
    border: "rgba(99,102,241,0.4)",
    iconColor: "#818cf8",
    glow: "0 0 80px rgba(99,102,241,0.3), 0 20px 60px rgba(0,0,0,0.7)",
  },
};

export function FlashConfirmOverlay() {
  const [flashes, setFlashes] = useState<FlashMessage[]>([]);

  const addFlash = useCallback((msg: FlashMessage) => {
    setFlashes((prev) => [...prev, msg]);
    setTimeout(() => {
      setFlashes((prev) => prev.filter((f) => f.id !== msg.id));
    }, 3500);
  }, []);

  useEffect(() => {
    listeners.push(addFlash);
    return () => {
      const idx = listeners.indexOf(addFlash);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, [addFlash]);

  if (flashes.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes flashSlideIn {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.75); }
          65%  { opacity: 1; transform: translate(-50%, -50%) scale(1.04); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes ringRadiate {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(3.5); opacity: 0; }
        }
      `}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 99998, pointerEvents: "none" }} />

      {flashes.map((flash, i) => {
        const cfg = CONFIG[flash.type];
        const Icon = cfg.icon;
        const offset = i * 90;
        return (
          <div
            key={flash.id}
            className="flash-card"
            style={{
              position: "fixed",
              top: `calc(50% + ${offset}px)`,
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 99999,
              pointerEvents: "auto",
              minWidth: 380,
              maxWidth: 500,
              borderRadius: 20,
              padding: "28px 32px",
              display: "flex",
              alignItems: "flex-start",
              gap: 18,
              animation: "flashSlideIn 0.35s cubic-bezier(0.34,1.4,0.64,1) both",
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              boxShadow: cfg.glow,
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Icon with radiating rings */}
            <div style={{ position: "relative", flexShrink: 0, width: 32, height: 32 }}>
              <div
                style={{
                  position: "absolute",
                  inset: -8,
                  borderRadius: "50%",
                  border: `2px solid ${cfg.ring}`,
                  animation: "ringRadiate 0.8s ease-out 0.1s both",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: -8,
                  borderRadius: "50%",
                  border: `2px solid ${cfg.ring}`,
                  animation: "ringRadiate 0.8s ease-out 0.3s both",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32 }}>
                <Icon size={24} color={cfg.iconColor} strokeWidth={2.5} />
              </div>
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#fff", fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>
                {flash.message}
              </div>
              {flash.description && (
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 3, lineHeight: 1.35 }}>
                  {flash.description}
                </div>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setFlashes((prev) => prev.filter((f) => f.id !== flash.id))}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: cfg.iconColor,
                opacity: 0.6,
                padding: 4,
                flexShrink: 0,
                marginTop: 2,
                lineHeight: 1,
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </>
  );
}
