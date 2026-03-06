import { useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { resolveNavigation, type NavigationEntry } from "@/lib/jarvis-navigation-map";
import type { GuidedTourStep } from "@/hooks/use-jarvis";

const TOOLTIP_ID = "jarvis-nav-tooltip";
const OVERLAY_ID = "jarvis-nav-overlay";
const HIGHLIGHT_CLASS = "jarvis-highlight";
const GLOW_CLASS = "jarvis-screen-glow";

/** Remove all Jarvis visual navigation artifacts */
function clearVisuals() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
    el.classList.remove(HIGHLIGHT_CLASS);
  });
  document.getElementById(TOOLTIP_ID)?.remove();
  removeOverlay();
  document.body.classList.remove(GLOW_CLASS);
}

/** Show the navigation transition overlay (spinner) */
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

/** Remove overlay with fade-out */
function removeOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (!existing) return;
  existing.classList.add("removing");
  setTimeout(() => existing.remove(), 200);
}

/** Inject a floating label tooltip above an element */
function showTooltip(el: HTMLElement, label: string) {
  document.getElementById(TOOLTIP_ID)?.remove();

  const rect = el.getBoundingClientRect();
  const tip = document.createElement("div");
  tip.id = TOOLTIP_ID;
  tip.className = "jarvis-nav-tooltip";
  tip.textContent = label;

  // Position above the element, centred
  tip.style.position = "fixed";
  tip.style.top = `${rect.top - 10}px`;
  tip.style.left = `${rect.left + rect.width / 2}px`;
  tip.style.transform = "translateX(-50%) translateY(-100%)";
  tip.style.zIndex = "9999";

  document.body.appendChild(tip);

  // Auto-remove after 4s
  setTimeout(() => tip.remove(), 4000);
}

/** Find a DOM element by data-jarvis-id with retries (for post-navigation render) */
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

/** Wait for a specified duration */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useJarvisNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tourAbortRef = useRef(false);
  const tourPausedRef = useRef(false);
  const tourSkipRef = useRef(false);
  const tourResumeResolverRef = useRef<(() => void) | null>(null);
  const [tourState, setTourState] = useState<TourState>({
    steps: [],
    currentStep: 0,
    status: "idle",
  });
    activeTimers.current.forEach(clearTimeout);
    activeTimers.current = [];
    tourAbortRef.current = true;
    clearVisuals();
  }, []);

  /** Highlight a DOM element by id with a glowing ring + tooltip */
  const highlightElement = useCallback(
    (targetId: string, label?: string) => {
      findElement(targetId, 8, (el) => {
        clearVisuals();
        el.classList.add(HIGHLIGHT_CLASS);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (label) showTooltip(el, label);

        // Auto-clear after 4s
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

  /** Programmatically click an element after highlighting it */
  const clickElement = useCallback(
    (targetId: string, label?: string) => {
      findElement(targetId, 8, (el) => {
        clearVisuals();
        el.classList.add(HIGHLIGHT_CLASS);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (label) showTooltip(el, label);

        // Click after a short highlight display
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

  /**
   * Full navigation sequence:
   * 1. Activate screen border glow
   * 2. Show transition overlay (spinner)
   * 3. Navigate to the resolved route
   * 4. Wait for render
   * 5. Remove overlay
   * 6. Highlight target element (if any)
   * 7. Show floating label tooltip
   * 8. Optionally click the element
   */
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

      // Resolve destination from navigation map or use raw path
      const entry: NavigationEntry | null = resolveNavigation(destination);
      const path = entry?.path || destination;
      const targetId = options?.targetId || entry?.targetId;
      const action = options?.targetAction || entry?.action;
      const label = options?.label || entry?.label || destination;

      const isSamePage = location.pathname === path;

      // Step 1: Screen border glow
      document.body.classList.add(GLOW_CLASS);
      track(setTimeout(() => document.body.classList.remove(GLOW_CLASS), 3000));

      // Step 2: Show overlay for cross-page navigation
      if (!isSamePage) {
        showOverlay();
        navigate(path);
      }

      // Step 3-8: After navigation renders, remove overlay + highlight/click
      const renderDelay = isSamePage ? 100 : 400;
      track(
        setTimeout(() => {
          // Remove transition overlay
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

  /**
   * Handle a Jarvis message's navigation payload directly.
   */
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

  /**
   * Execute a guided tour — a sequence of navigate/highlight/click steps
   * with optional TTS speech at each step.
   */
  const runGuidedTour = useCallback(
    async (
      steps: GuidedTourStep[],
      speakFn?: (text: string) => Promise<void>
    ) => {
      tourAbortRef.current = false;

      // Activate screen glow for the duration
      document.body.classList.add(GLOW_CLASS);

      for (const step of steps) {
        if (tourAbortRef.current) break;

        // Navigate if needed
        if (step.navigate) {
          const isSamePage = location.pathname === step.navigate;
          if (!isSamePage) {
            showOverlay();
            navigate(step.navigate);
            await wait(500); // Wait for navigation render
            removeOverlay();
          }
        }

        if (tourAbortRef.current) break;

        // Speak (non-blocking start, but we wait for delay)
        if (step.speak && speakFn) {
          speakFn(step.speak);
        }

        // Highlight element
        if (step.highlight) {
          await new Promise<void>((resolve) => {
            findElement(step.highlight!, 10, (el) => {
              clearVisuals();
              document.body.classList.add(GLOW_CLASS); // Re-add glow after clearVisuals
              el.classList.add(HIGHLIGHT_CLASS);
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              if (step.speak) showTooltip(el, step.speak);
              resolve();
            });
            // Resolve after timeout if element not found
            setTimeout(resolve, 3000);
          });
        }

        // Click element
        if (step.click) {
          await new Promise<void>((resolve) => {
            findElement(step.click!, 10, (el) => {
              clearVisuals();
              document.body.classList.add(GLOW_CLASS);
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

        // Wait for the step's delay
        const delay = step.delay || 1500;
        await wait(delay);
      }

      // Clean up glow at the end
      document.body.classList.remove(GLOW_CLASS);
    },
    [navigate, location.pathname]
  );

  return {
    navigateTo,
    highlightElement,
    clickElement,
    clearAll,
    handleMessageNavigation,
    runGuidedTour,
  };
}
