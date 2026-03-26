import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type FlashType = "success" | "error" | "warning" | "info";

interface FlashMessage {
  id: string;
  message: string;
  description?: string;
  type: FlashType;
}

type Listener = (msg: FlashMessage) => void;
const listeners: Listener[] = [];

export function flashConfirm(message: string, type: FlashType = "success", description?: string) {
  const msg: FlashMessage = {
    id: Math.random().toString(36).slice(2),
    message,
    description,
    type,
  };
  listeners.forEach((fn) => fn(msg));
}

const TYPE_CONFIG: Record<FlashType, {
  icon: typeof CheckCircle2;
  gradient: string;
  ring: string;
  glow: string;
  iconColor: string;
}> = {
  success: {
    icon: CheckCircle2,
    gradient: "linear-gradient(135deg, rgba(5,46,22,0.95), rgba(20,83,45,0.92))",
    ring: "rgba(52,211,153,0.5)",
    glow: "0 0 60px rgba(52,211,153,0.25)",
    iconColor: "#34d399",
  },
  error: {
    icon: XCircle,
    gradient: "linear-gradient(135deg, rgba(69,10,10,0.95), rgba(127,29,29,0.92))",
    ring: "rgba(248,113,113,0.5)",
    glow: "0 0 60px rgba(248,113,113,0.25)",
    iconColor: "#f87171",
  },
  warning: {
    icon: AlertTriangle,
    gradient: "linear-gradient(135deg, rgba(69,46,3,0.95), rgba(113,63,18,0.92))",
    ring: "rgba(251,191,36,0.5)",
    glow: "0 0 60px rgba(251,191,36,0.25)",
    iconColor: "#fbbf24",
  },
  info: {
    icon: Info,
    gradient: "linear-gradient(135deg, rgba(30,27,75,0.95), rgba(49,46,129,0.92))",
    ring: "rgba(99,102,241,0.5)",
    glow: "0 0 60px rgba(99,102,241,0.25)",
    iconColor: "#6366f1",
  },
};

const FLASH_STYLES = `
@keyframes flashIn {
  from { opacity: 0; transform: scale(0.82) translateY(-16px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes flashOut {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to   { opacity: 0; transform: scale(0.88) translateY(-10px); }
}
@keyframes ringPulse {
  0%   { transform: scale(1);   opacity: 0.9; }
  60%  { transform: scale(2.2); opacity: 0.3; }
  100% { transform: scale(2.8); opacity: 0; }
}
`;

export function FlashConfirmOverlay() {
  const [flashes, setFlashes] = useState<(FlashMessage & { exiting?: boolean })[]>([]);

  useEffect(() => {
    const handler: Listener = (msg) => {
      setFlashes((prev) => [...prev, msg]);
      setTimeout(() => {
        setFlashes((prev) =>
          prev.map((f) => (f.id === msg.id ? { ...f, exiting: true } : f))
        );
        setTimeout(() => {
          setFlashes((prev) => prev.filter((f) => f.id !== msg.id));
        }, 300);
      }, 3200);
    };
    listeners.push(handler);
    return () => {
      const i = listeners.indexOf(handler);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setFlashes((prev) =>
      prev.map((f) => (f.id === id ? { ...f, exiting: true } : f))
    );
    setTimeout(() => {
      setFlashes((prev) => prev.filter((f) => f.id !== id));
    }, 300);
  }, []);

  if (flashes.length === 0) return null;

  return (
    <>
      <style>{FLASH_STYLES}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        {flashes.map((flash) => {
          const cfg = TYPE_CONFIG[flash.type];
          const Icon = cfg.icon;
          return (
            <div
              key={flash.id}
              style={{
                pointerEvents: "auto",
                animation: flash.exiting
                  ? "flashOut 0.3s ease-in forwards"
                  : "flashIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                background: cfg.gradient,
                backdropFilter: "blur(16px)",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: `${cfg.glow}, 0 8px 32px rgba(0,0,0,0.4)`,
                padding: "20px 28px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                minWidth: 340,
                maxWidth: 520,
                position: "relative",
              }}
            >
              {/* Icon with pulse ring */}
              <div style={{ position: "relative", flexShrink: 0, width: 36, height: 36 }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `2px solid ${cfg.ring}`,
                    animation: "ringPulse 1.6s ease-out infinite",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36 }}>
                  <Icon size={24} color={cfg.iconColor} strokeWidth={2.5} />
                </div>
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 600,
                    lineHeight: 1.4,
                    fontFamily: "inherit",
                  }}
                >
                  {flash.message}
                </div>
                {flash.description && (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 13,
                      marginTop: 2,
                      lineHeight: 1.35,
                      fontFamily: "inherit",
                    }}
                  >
                    {flash.description}
                  </div>
                )}
              </div>

              {/* Dismiss */}
              <button
                onClick={() => dismiss(flash.id)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: 8,
                  padding: 4,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "rgba(255,255,255,0.5)",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
