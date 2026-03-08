import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useJarvisSettings } from "@/hooks/use-jarvis-settings";

/* ─── Types ─── */
interface Tooltip {
  elementId: string;
  label: string;
  top: number;
  left: number;
}

interface JarvisSpotlightContextValue {
  isSpotlightActive: boolean;
  setSpotlightActive: (active: boolean) => void;
  highlightElement: (elementId: string, label?: string) => void;
  clearHighlight: (elementId?: string) => void;
  setScreenGlow: (active: boolean) => void;
  showNavigationOverlay: () => void;
  hideNavigationOverlay: () => void;
  /** Internal state for rendering */
  _screenGlowActive: boolean;
  _tooltips: Tooltip[];
  _navOverlayVisible: boolean;
  _navOverlayRemoving: boolean;
}

const JarvisSpotlightContext = createContext<JarvisSpotlightContextValue | null>(null);

export function useJarvisSpotlight() {
  const ctx = useContext(JarvisSpotlightContext);
  if (!ctx) throw new Error("useJarvisSpotlight must be used inside JarvisSpotlightProvider");
  return ctx;
}

/* ─── Provider ─── */
export function JarvisSpotlightProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useJarvisSettings();
  const spotlightEnabled = (settings as any)?.spotlight_enabled !== false; // default ON

  const [isSpotlightActive, setSpotlightActiveRaw] = useState(true);
  const [screenGlowActive, setScreenGlowActive] = useState(false);
  const [tooltips, setTooltips] = useState<Tooltip[]>([]);
  const [navOverlayVisible, setNavOverlayVisible] = useState(false);
  const [navOverlayRemoving, setNavOverlayRemoving] = useState(false);
  const highlightedIds = useRef<Set<string>>(new Set());
  const navOverlayTimer = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();

  // Master toggle — respects workspace setting
  const effectiveActive = spotlightEnabled && isSpotlightActive;

  const setSpotlightActive = useCallback((active: boolean) => {
    setSpotlightActiveRaw(active);
  }, []);

  const setScreenGlow = useCallback((active: boolean) => {
    if (!effectiveActive && active) return;
    setScreenGlowActive(active);
  }, [effectiveActive]);

  const highlightElement = useCallback((elementId: string, label?: string) => {
    if (!effectiveActive) return;
    const el = document.querySelector(`[data-jarvis-id="${elementId}"]`) as HTMLElement | null;
    if (!el) return;

    el.classList.add("jarvis-spotlight");
    highlightedIds.current.add(elementId);

    // Compute tooltip position
    const rect = el.getBoundingClientRect();
    const resolvedLabel =
      label || el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 40) || elementId;

    setTooltips((prev) => [
      ...prev.filter((t) => t.elementId !== elementId),
      {
        elementId,
        label: resolvedLabel,
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
      },
    ]);
  }, [effectiveActive]);

  const clearHighlight = useCallback((elementId?: string) => {
    if (elementId) {
      const el = document.querySelector(`[data-jarvis-id="${elementId}"]`);
      el?.classList.remove("jarvis-spotlight", "jarvis-highlight");
      highlightedIds.current.delete(elementId);
      setTooltips((prev) => prev.filter((t) => t.elementId !== elementId));
    } else {
      // Clear all
      highlightedIds.current.forEach((id) => {
        const el = document.querySelector(`[data-jarvis-id="${id}"]`);
        el?.classList.remove("jarvis-spotlight", "jarvis-highlight");
      });
      highlightedIds.current.clear();
      setTooltips([]);
    }
  }, []);

  const showNavigationOverlay = useCallback(() => {
    if (!effectiveActive) return;
    setNavOverlayRemoving(false);
    setNavOverlayVisible(true);

    // Auto-dismiss after 600ms max
    clearTimeout(navOverlayTimer.current);
    navOverlayTimer.current = setTimeout(() => {
      setNavOverlayRemoving(true);
      setTimeout(() => setNavOverlayVisible(false), 200);
    }, 600);
  }, [effectiveActive]);

  const hideNavigationOverlay = useCallback(() => {
    setNavOverlayRemoving(true);
    setTimeout(() => {
      setNavOverlayVisible(false);
      setNavOverlayRemoving(false);
    }, 200);
  }, []);

  // Dismiss navigation overlay on route change
  useEffect(() => {
    if (navOverlayVisible) {
      hideNavigationOverlay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeout(navOverlayTimer.current);
  }, []);

  return (
    <JarvisSpotlightContext.Provider
      value={{
        isSpotlightActive: effectiveActive,
        setSpotlightActive,
        highlightElement,
        clearHighlight,
        setScreenGlow,
        showNavigationOverlay,
        hideNavigationOverlay,
        _screenGlowActive: effectiveActive && screenGlowActive,
        _tooltips: effectiveActive ? tooltips : [],
        _navOverlayVisible: effectiveActive && navOverlayVisible,
        _navOverlayRemoving: navOverlayRemoving,
      }}
    >
      {children}
    </JarvisSpotlightContext.Provider>
  );
}

/* ─── Overlay Renderer (mount once in App.tsx) ─── */
export function JarvisSpotlightOverlay() {
  const ctx = useContext(JarvisSpotlightContext);
  if (!ctx) return null;

  const { _screenGlowActive, _tooltips, _navOverlayVisible, _navOverlayRemoving } = ctx;

  return (
    <>
      {/* Screen border glow — ALWAYS in DOM, toggle opacity via class only */}
      <div
        className={`jarvis-screen-glow ${_screenGlowActive ? "active" : ""}`}
        aria-hidden="true"
      />

      {/* Element tooltips */}
      {_tooltips.map((t) => (
        <div
          key={t.elementId}
          className="jarvis-spotlight-tooltip"
          style={{ top: t.top, left: t.left, transform: "translateX(-50%) translateY(-100%)" }}
          aria-hidden="true"
        >
          {t.label}
        </div>
      ))}

      {/* Navigation transition overlay */}
      {_navOverlayVisible && (
        <div
          className={`jarvis-nav-overlay ${_navOverlayRemoving ? "removing" : ""}`}
          aria-hidden="true"
        >
          <div className="jarvis-nav-spinner" />
          <span className="jarvis-nav-overlay-text">Navigating…</span>
        </div>
      )}
    </>
  );
}
