/**
 * JarvisSpotlightManager — singleton class (NOT a React hook)
 * Can be called from anywhere: components, edge-function handlers, callbacks.
 *
 * Reuses existing CSS classes from index.css:
 *   .jarvis-highlight   — orange pulsing ring on an element
 *   .jarvis-screen-glow — orange border glow on <body>
 *   .jarvis-nav-tooltip  — floating label above element
 */

const HIGHLIGHT_CLASS = "jarvis-highlight";
const GLOW_CLASS = "jarvis-screen-glow";
const TOOLTIP_ID = "jarvis-spotlight-tooltip";

/* ------------------------------------------------------------------ */
/*  Keyword → target map                                               */
/* ------------------------------------------------------------------ */

interface SpotlightMapping {
  keywords: string[];
  targets: string[];
  section?: "page";
}

const autoSpotlightMap: SpotlightMapping[] = [
  { keywords: ["home page", "command centre", "command center"], targets: ["nav-home"], section: "page" },
  { keywords: ["pipeline", "deal pipeline", "pipeline snapshot"], targets: ["home-pipeline-snapshot"] },
  { keywords: ["my work"], targets: ["home-my-work"] },
  { keywords: ["diary"], targets: ["home-diary"] },
  { keywords: ["add company", "new company"], targets: ["add-company-button"] },
  { keywords: ["companies", "accounts"], targets: ["nav-companies"] },
  { keywords: ["contacts"], targets: ["nav-contacts"] },
  { keywords: ["canvas", "org chart"], targets: ["nav-canvas"] },
  { keywords: ["talent", "candidates"], targets: ["nav-talent"] },
  { keywords: ["jobs", "job board"], targets: ["nav-jobs"] },
  { keywords: ["outreach", "campaigns"], targets: ["nav-outreach"] },
  { keywords: ["insights", "revenue intelligence"], targets: ["nav-insights"] },
  { keywords: ["admin", "settings"], targets: ["nav-admin"] },
  { keywords: ["billing", "invoices", "outstanding"], targets: ["home-billing-snapshot"] },
  { keywords: ["active projects", "projects"], targets: ["nav-projects"] },
  { keywords: ["shortlist"], targets: ["job-tab-shortlist"] },
  { keywords: ["adverts", "job adverts"], targets: ["job-tab-adverts"] },
  { keywords: ["applications"], targets: ["job-tab-applications"] },
  { keywords: ["generate spec", "job spec"], targets: ["job-generate-spec-button"] },
  { keywords: ["run shortlist"], targets: ["job-run-shortlist-button"] },
  { keywords: ["add contact", "new contact"], targets: ["add-contact-button"] },
  { keywords: ["add candidate"], targets: ["add-candidate-button"] },
  { keywords: ["refresh"], targets: ["home-refresh-button"] },
  { keywords: ["create invoice"], targets: ["home-create-invoice-button"] },
  { keywords: ["stat cards", "top cards", "overview cards", "top-line"], targets: ["home-stat-cards"] },
  { keywords: ["alerts", "billing alerts"], targets: ["home-alerts-strip"] },
  { keywords: ["sows", "contracts", "statements of work"], targets: ["home-sows-contracts"] },
  { keywords: ["outreach stats", "queued", "contacted", "responded", "booked"], targets: ["home-outreach-stats"] },
  { keywords: ["pull report", "report builder"], targets: ["pull-report"] },
  { keywords: ["take the tour", "guided tour"], targets: ["home-tour-button"] },
];

/* ------------------------------------------------------------------ */
/*  DOM helpers                                                        */
/* ------------------------------------------------------------------ */

function findEl(targetId: string): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(`[data-jarvis-id="${targetId}"]`) ||
    document.getElementById(targetId)
  );
}

function showTooltipAbove(el: HTMLElement, label: string) {
  removeTooltip();
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
}

function removeTooltip() {
  document.getElementById(TOOLTIP_ID)?.remove();
}

/* ------------------------------------------------------------------ */
/*  Singleton class                                                    */
/* ------------------------------------------------------------------ */

class JarvisSpotlightManager {
  private _autoClearTimer: ReturnType<typeof setTimeout> | null = null;
  private _activeElements: HTMLElement[] = [];

  /** Highlight a single element by its data-jarvis-id */
  highlight(id: string, label?: string, duration = 4000): void {
    const el = findEl(id);
    if (!el) return;

    el.classList.add(HIGHLIGHT_CLASS);
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    this._activeElements.push(el);

    if (label) showTooltipAbove(el, label);

    // Auto-clear after duration
    this._scheduleAutoClear(duration);
  }

  /** Highlight multiple targets at once */
  highlightMany(ids: string[], duration = 4000): void {
    for (const id of ids) {
      const el = findEl(id);
      if (!el) continue;
      el.classList.add(HIGHLIGHT_CLASS);
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      this._activeElements.push(el);
    }
    this._scheduleAutoClear(duration);
  }

  /** Highlight a section by its data-jarvis-id */
  highlightSection(sectionName: string, label?: string): void {
    this.highlight(sectionName, label);
  }

  /** Activate full page border glow */
  activatePageGlow(): void {
    document.body.classList.add(GLOW_CLASS);
  }

  /** Deactivate full page border glow */
  deactivatePageGlow(): void {
    document.body.classList.remove(GLOW_CLASS);
  }

  /** Highlight a nav item */
  highlightNav(navId: string): void {
    this.highlight(navId);
  }

  /** Clear all spotlights */
  clearAll(): void {
    if (this._autoClearTimer) {
      clearTimeout(this._autoClearTimer);
      this._autoClearTimer = null;
    }
    for (const el of this._activeElements) {
      el.classList.remove(HIGHLIGHT_CLASS);
    }
    this._activeElements = [];
    removeTooltip();
    this.deactivatePageGlow();
  }

  /**
   * THE KEY METHOD: Parse speech text and auto-highlight matching elements.
   * Call this every time Jarvis is about to speak.
   */
  autoSpotlight(speechText: string): void {
    if (!speechText) return;

    // Clear previous spotlights before applying new ones
    this.clearAll();

    const lower = speechText.toLowerCase();
    const matchedTargets: string[] = [];
    let needsPageGlow = false;

    for (const mapping of autoSpotlightMap) {
      const matched = mapping.keywords.some((kw) => lower.includes(kw));
      if (matched) {
        matchedTargets.push(...mapping.targets);
        if (mapping.section === "page") {
          needsPageGlow = true;
        }
      }
    }

    if (needsPageGlow) {
      this.activatePageGlow();
    }

    if (matchedTargets.length > 0) {
      // Deduplicate
      const unique = [...new Set(matchedTargets)];
      this.highlightMany(unique, 5000);
    }
  }

  /* ---- private ---- */

  private _scheduleAutoClear(duration: number): void {
    if (this._autoClearTimer) clearTimeout(this._autoClearTimer);
    this._autoClearTimer = setTimeout(() => {
      this.clearAll();
    }, duration);
  }
}

/** Global singleton — import and use from anywhere */
export const jarvisSpotlight = new JarvisSpotlightManager();
