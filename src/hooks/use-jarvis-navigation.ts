import { useCallback, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { resolveNavigation, type NavigationEntry } from "@/lib/jarvis-navigation-map";
import type { GuidedTourStep } from "@/hooks/use-jarvis";
import type { TourState } from "@/components/jarvis/GuidedTourPlayer";

const TOOLTIP_ID = "jarvis-nav-tooltip";
const OVERLAY_ID = "jarvis-nav-overlay";
const HIGHLIGHT_CLASS = "jarvis-highlight";
const GLOW_CLASS = "jarvis-screen-glow";

/* ------------------------------------------------------------------ */
/*  DOM helpers                                                        */
/* ------------------------------------------------------------------ */

function clearVisuals() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
    el.classList.remove(HIGHLIGHT_CLASS);
  });
  document.getElementById(TOOLTIP_ID)?.remove();
  removeOverlay();
  document.body.classList.remove(GLOW_CLASS);
}

function showOverlay() {
  removeOverlay();
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "jarvis-nav-overlay";
  const spinner = document.createElement("div");
  spinner.className = "jarvis-nav-spinner";
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
}

function removeOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (!existing) return;
  existing.classList.add("removing");
  setTimeout(() => existing.remove(), 200);
}

function showTooltip(el: HTMLElement, label: string) {
  document.getElementById(TOOLTIP_ID)?.remove();
  const rect = el.getBoundingClientRect();
  const tip = document.createElement("div");
  tip.id = TOOLTIP_ID;
  tip.className = "jarvis-nav-tooltip";
  tip.textContent = label;
  tip.style.position = "fixed";
  tip.style.top = `${rect.top - 10}px`;
  tip.style.left = `${rect.left + rect.width / 2}px`;
  tip.style.transform = "translateX(-50%) translateY(-100%)";
  tip.style.zIndex = "9999";
  document.body.appendChild(tip);
  setTimeout(() => tip.remove(), 4000);
}

function findElement(
  targetId: string,
  maxRetries: number,
  onFound: (el: HTMLElement) => void
) {
  const attempt = (retries: number) => {
    const el =
      document.querySelector<HTMLElement>(`[data-jarvis-id="${targetId}"]`) ||
      document.getElementById(targetId);
    if (el) {
      onFound(el);
    } else if (retries > 0) {
      setTimeout(() => attempt(retries - 1), 300);
    }
  };
  attempt(maxRetries);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Map route paths to human-friendly page names */
function getPageName(pathname: string): string {
  const map: Record<string, string> = {
    "/home": "Home",
    "/companies": "Companies",
    "/contacts": "Contacts",
    "/talent": "Talent Database",
    "/outreach": "Outreach",
    "/executive-insights": "Revenue Intelligence",
    "/canvas": "Canvas",
    "/projects": "Projects",
    "/reports": "Reports",
    "/crm/deals": "Deals",
    "/crm/pipeline": "Pipeline",
    "/crm/invoices": "Invoices",
    "/crm/documents": "Documents",
    "/crm/projects": "CRM Projects",
    "/admin": "Admin",
  };
  // Check prefix matches for detail pages
  for (const [prefix, name] of Object.entries(map)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return name;
  }
  return "current";
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useJarvisNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Tour control refs
  const tourAbortRef = useRef(false);
  const tourPausedRef = useRef(false);
  const tourSkipRef = useRef(false);
  const tourResumeRef = useRef<(() => void) | null>(null);

  const [tourState, setTourState] = useState<TourState>({
    steps: [],
    currentStep: 0,
    status: "idle",
  });

  const track = (timer: ReturnType<typeof setTimeout>) => {
    activeTimers.current.push(timer);
  };

  const clearAll = useCallback(() => {
    activeTimers.current.forEach(clearTimeout);
    activeTimers.current = [];
    tourAbortRef.current = true;
    tourPausedRef.current = false;
    tourSkipRef.current = false;
    if (tourResumeRef.current) {
      tourResumeRef.current();
      tourResumeRef.current = null;
    }
    clearVisuals();
    setTourState({ steps: [], currentStep: 0, status: "idle" });
  }, []);

  const highlightElement = useCallback(
    (targetId: string, label?: string) => {
      findElement(targetId, 8, (el) => {
        clearVisuals();
        el.classList.add(HIGHLIGHT_CLASS);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (label) showTooltip(el, label);
        track(
          setTimeout(() => {
            el.classList.remove(HIGHLIGHT_CLASS);
            document.getElementById(TOOLTIP_ID)?.remove();
          }, 4000)
        );
      });
    },
    []
  );

  const clickElement = useCallback(
    (targetId: string, label?: string) => {
      findElement(targetId, 8, (el) => {
        clearVisuals();
        el.classList.add(HIGHLIGHT_CLASS);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (label) showTooltip(el, label);
        track(
          setTimeout(() => {
            el.click();
            track(
              setTimeout(() => {
                el.classList.remove(HIGHLIGHT_CLASS);
                document.getElementById(TOOLTIP_ID)?.remove();
              }, 1500)
            );
          }, 700)
        );
      });
    },
    []
  );

  const navigateTo = useCallback(
    (
      destination: string,
      options?: {
        targetId?: string;
        targetAction?: "click";
        label?: string;
      }
    ) => {
      clearAll();
      const entry: NavigationEntry | null = resolveNavigation(destination);
      const path = entry?.path || destination;
      const targetId = options?.targetId || entry?.targetId;
      const action = options?.targetAction || entry?.action;
      const label = options?.label || entry?.label || destination;
      const isSamePage = location.pathname === path;

      document.body.classList.add(GLOW_CLASS);
      track(setTimeout(() => document.body.classList.remove(GLOW_CLASS), 3000));

      if (!isSamePage) {
        showOverlay();
        navigate(path);
      }

      const renderDelay = isSamePage ? 100 : 400;
      track(
        setTimeout(() => {
          if (!isSamePage) removeOverlay();
          if (targetId) {
            if (action === "click") {
              clickElement(targetId, label);
            } else {
              highlightElement(targetId, label);
            }
          }
        }, renderDelay)
      );
    },
    [navigate, location.pathname, clearAll, highlightElement, clickElement]
  );

  const handleMessageNavigation = useCallback(
    (msg: {
      navigateTo?: string;
      targetId?: string;
      targetAction?: "click";
    }) => {
      if (!msg.navigateTo && !msg.targetId) return;
      if (msg.navigateTo) {
        navigateTo(msg.navigateTo, {
          targetId: msg.targetId,
          targetAction: msg.targetAction,
        });
      } else if (msg.targetId) {
        if (msg.targetAction === "click") {
          clickElement(msg.targetId);
        } else {
          highlightElement(msg.targetId);
        }
      }
    },
    [navigateTo, clickElement, highlightElement]
  );

  /* ---------------------------------------------------------------- */
  /*  Tour controls                                                    */
  /* ---------------------------------------------------------------- */

  const pauseTour = useCallback(() => {
    tourPausedRef.current = true;
    setTourState((s) => (s.status === "running" ? { ...s, status: "paused" } : s));
  }, []);

  const resumeTour = useCallback(() => {
    tourPausedRef.current = false;
    setTourState((s) => (s.status === "paused" ? { ...s, status: "running" } : s));
    // Wake up the waiting loop
    if (tourResumeRef.current) {
      tourResumeRef.current();
      tourResumeRef.current = null;
    }
  }, []);

  const skipTourStep = useCallback(() => {
    tourSkipRef.current = true;
    // If paused, also resume so we move to next step
    if (tourPausedRef.current) {
      tourPausedRef.current = false;
      setTourState((s) => ({ ...s, status: "running" }));
    }
    if (tourResumeRef.current) {
      tourResumeRef.current();
      tourResumeRef.current = null;
    }
  }, []);

  const stopTour = useCallback(() => {
    tourAbortRef.current = true;
    tourPausedRef.current = false;
    tourSkipRef.current = false;
    if (tourResumeRef.current) {
      tourResumeRef.current();
      tourResumeRef.current = null;
    }
    clearVisuals();
    setTourState({ steps: [], currentStep: 0, status: "idle" });
  }, []);

  /** Wait that respects pause/skip/abort */
  const controlledWait = useCallback(async (ms: number) => {
    const chunk = 100;
    let elapsed = 0;
    while (elapsed < ms) {
      if (tourAbortRef.current || tourSkipRef.current) return;
      if (tourPausedRef.current) {
        // Wait until resumed
        await new Promise<void>((resolve) => {
          tourResumeRef.current = resolve;
        });
        if (tourAbortRef.current || tourSkipRef.current) return;
      }
      await wait(Math.min(chunk, ms - elapsed));
      elapsed += chunk;
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Guided Tour Runner                                               */
  /* ---------------------------------------------------------------- */

  const runGuidedTour = useCallback(
    async (
      steps: GuidedTourStep[],
      speakFn?: (text: string) => Promise<void>
    ): Promise<string> => {
      tourAbortRef.current = false;
      tourPausedRef.current = false;
      tourSkipRef.current = false;

      setTourState({ steps, currentStep: 0, status: "running" });
      document.body.classList.add(GLOW_CLASS);

      let lastPath = location.pathname;

      for (let i = 0; i < steps.length; i++) {
        if (tourAbortRef.current) break;

        // Reset skip flag for this step
        tourSkipRef.current = false;

        setTourState({ steps, currentStep: i, status: "running" });
        const step = steps[i];

        // --- Speak first (so user knows what's about to happen) ---
        if (step.speak && speakFn && !tourSkipRef.current) {
          await speakFn(step.speak);
        }

        if (tourAbortRef.current) break;
        if (tourSkipRef.current) continue;

        // --- Navigate if needed ---
        if (step.navigate) {
          const isSamePage = lastPath === step.navigate;
          if (!isSamePage) {
            showOverlay();
            navigate(step.navigate);
            lastPath = step.navigate;
            await wait(500);
            removeOverlay();
          }
        }

        if (tourAbortRef.current) break;
        if (tourSkipRef.current) continue;

        // --- Highlight element ---
        if (step.highlight) {
          await new Promise<void>((resolve) => {
            findElement(step.highlight!, 10, (el) => {
              // Clear previous highlights but keep glow
              document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((e) =>
                e.classList.remove(HIGHLIGHT_CLASS)
              );
              document.getElementById(TOOLTIP_ID)?.remove();

              el.classList.add(HIGHLIGHT_CLASS);
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              if (step.speak) showTooltip(el, step.speak);
              resolve();
            });
            setTimeout(resolve, 3000);
          });
        }

        // --- Click element ---
        if (step.click) {
          await new Promise<void>((resolve) => {
            findElement(step.click!, 10, (el) => {
              document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((e) =>
                e.classList.remove(HIGHLIGHT_CLASS)
              );
              document.getElementById(TOOLTIP_ID)?.remove();

              el.classList.add(HIGHLIGHT_CLASS);
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              if (step.speak) showTooltip(el, step.speak);
              setTimeout(() => {
                el.click();
                setTimeout(() => {
                  el.classList.remove(HIGHLIGHT_CLASS);
                  document.getElementById(TOOLTIP_ID)?.remove();
                  resolve();
                }, 500);
              }, 700);
            });
            setTimeout(resolve, 3000);
          });
        }

        if (tourAbortRef.current) break;

        // --- Controlled delay (respects pause/skip/abort) ---
        const delay = step.delay || 1500;
        await controlledWait(delay);
      }

      // Clean up
      clearVisuals();
      const finalPage = getPageName(lastPath);
      setTourState({ steps, currentStep: steps.length - 1, status: "completed" });

      // Auto-reset after a moment
      setTimeout(() => {
        setTourState({ steps: [], currentStep: 0, status: "idle" });
      }, 500);

      return tourAbortRef.current
        ? ""
        : `All done. You're on the ${finalPage} page.`;
    },
    [navigate, location.pathname, controlledWait]
  );

  return {
    navigateTo,
    highlightElement,
    clickElement,
    clearAll,
    handleMessageNavigation,
    runGuidedTour,
    tourState,
    pauseTour,
    resumeTour,
    skipTourStep,
    stopTour,
  };
}
