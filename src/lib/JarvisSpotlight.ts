/**
 * JarvisSpotlightManager — singleton class (NOT a React hook)
 * Can be called from anywhere: components, edge-function handlers, callbacks.
 */

const HIGHLIGHT_CLASS = "jarvis-highlight";
const SECTION_GLOW_CLASS = "jarvis-section-glow";
const NAV_HIGHLIGHT_CLASS = "jarvis-nav-highlight";
const PAGE_GLOW_ID = "jarvis-page-glow-overlay";
const TOOLTIP_ID = "jarvis-spotlight-tooltip";

/* ------------------------------------------------------------------ */
/*  Keyword → target map                                               */
/* ------------------------------------------------------------------ */

interface SpotlightMapping {
  keywords: string[];
  targets: string[];          // data-jarvis-id targets
  sections?: string[];        // data-jarvis-section targets (gentler glow)
  navTargets?: string[];      // nav items to highlight (background glow)
  section?: "page";           // triggers page border glow
}

const autoSpotlightMap: SpotlightMapping[] = [
  { keywords: ["home page", "command centre", "command center"], targets: [], navTargets: ["nav-home"], section: "page" },
  { keywords: ["pipeline", "deal pipeline", "pipeline snapshot"], targets: ["home-pipeline-snapshot"], sections: ["pipeline-snapshot"] },
  { keywords: ["my work"], targets: ["home-my-work"], sections: ["my-work"] },
  { keywords: ["diary"], targets: ["home-diary"], sections: ["diary"] },
  { keywords: ["add company", "new company"], targets: ["add-company-button"] },
  { keywords: ["companies", "accounts"], targets: [], navTargets: ["nav-companies"] },
  { keywords: ["contacts"], targets: [], navTargets: ["nav-contacts"] },
  { keywords: ["canvas", "org chart"], targets: [], navTargets: ["nav-canvas"] },
  { keywords: ["talent", "candidates"], targets: [], navTargets: ["nav-talent"] },
  { keywords: ["jobs", "job board"], targets: [], navTargets: ["nav-jobs"] },
  { keywords: ["outreach", "campaigns"], targets: [], navTargets: ["nav-outreach"] },
  { keywords: ["insights", "revenue intelligence"], targets: [], navTargets: ["nav-insights"] },
  { keywords: ["admin", "settings"], targets: [], navTargets: ["nav-admin"] },
  { keywords: ["billing", "invoices", "outstanding"], targets: ["home-billing-snapshot"], sections: ["billing-snapshot"] },
  { keywords: ["active projects", "projects"], targets: ["home-active-projects"], sections: ["active-projects"], navTargets: ["nav-projects"] },
  { keywords: ["shortlist"], targets: ["job-tab-shortlist"], sections: ["job-shortlist-table"] },
  { keywords: ["adverts", "job adverts"], targets: ["job-tab-adverts"], sections: ["job-adverts-list"] },
  { keywords: ["applications"], targets: ["job-tab-applications"], sections: ["job-applications-table"] },
  { keywords: ["generate spec", "job spec"], targets: ["job-generate-spec-button"] },
  { keywords: ["run shortlist"], targets: ["job-run-shortlist-button"] },
  { keywords: ["add contact", "new contact"], targets: ["add-contact-button"] },
  { keywords: ["add candidate"], targets: ["add-candidate-button"] },
  { keywords: ["refresh"], targets: ["home-refresh-button"] },
  { keywords: ["create invoice"], targets: ["home-create-invoice-button"] },
  { keywords: ["stat cards", "top cards", "overview cards", "top-line"], targets: ["home-kpi-row"], sections: ["stat-cards"] },
  { keywords: ["alerts", "billing alerts"], targets: ["home-alerts-strip"], sections: ["alerts-strip"] },
  { keywords: ["sows", "contracts", "statements of work"], targets: [], sections: ["sows-contracts"] },
  { keywords: ["outreach stats", "queued", "contacted", "responded", "booked"], targets: [], sections: ["outreach-stats"] },
  { keywords: ["pull report", "report builder"], targets: ["pull-report"] },
  { keywords: ["take the tour", "guided tour"], targets: ["home-tour-button"] },
  { keywords: ["job brief"], targets: [], sections: ["job-brief-box"] },
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

function findSection(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-jarvis-section="${name}"]`);
}

function ensurePageGlowDiv(): HTMLElement {
  let div = document.getElementById(PAGE_GLOW_ID);
  if (!div) {
    div = document.createElement("div");
    div.id = PAGE_GLOW_ID;
    div.className = "jarvis-page-glow";
    document.body.appendChild(div);
  }
  return div;
}

function showTooltipAbove(el: HTMLElement, label: string) {
  removeTooltip();
  const rect = el.getBoundingClientRect();
  const tip = document.createElement("div");
  tip.id = TOOLTIP_ID;
  tip.className = "jarvis-spotlight-tooltip";
  tip.textContent = label;
  tip.style.left = `${rect.left + rect.width / 2}px`;
  tip.style.top = `${rect.top - 10}px`;
  tip.style.transform = "translateX(-50%) translateY(-100%)";
  document.body.appendChild(tip);

  requestAnimationFrame(() => {
    const tipRect = tip.getBoundingClientRect();
    if (tipRect.top < 4) {
      tip.style.top = `${rect.bottom + 10}px`;
      tip.style.transform = "translateX(-50%) translateY(0)";
    }
  });
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
  private _activeSections: HTMLElement[] = [];
  private _activeNavItems: HTMLElement[] = [];

  /** Highlight a single element by its data-jarvis-id */
  highlight(id: string, label?: string, duration = 4000): void {
    const el = findEl(id);
    if (!el) return;
    el.classList.add(HIGHLIGHT_CLASS);
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    this._activeElements.push(el);
    if (label) showTooltipAbove(el, label);
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

  /** Highlight a section (gentler glow, no tooltip) */
  highlightSection(sectionName: string, _label?: string): void {
    const el = findSection(sectionName);
    if (!el) return;
    el.classList.add(SECTION_GLOW_CLASS);
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    this._activeSections.push(el);
  }

  /** Highlight a nav item with background glow for 3s */
  highlightNav(navId: string): void {
    const el = findEl(navId);
    if (!el) return;
    el.classList.add(NAV_HIGHLIGHT_CLASS);
    this._activeNavItems.push(el);
  }

  /** Activate full page border glow */
  activatePageGlow(): void {
    const div = ensurePageGlowDiv();
    div.classList.add("active");
  }

  /** Deactivate full page border glow */
  deactivatePageGlow(): void {
    const div = document.getElementById(PAGE_GLOW_ID);
    if (div) div.classList.remove("active");
  }

  /** Clear all spotlights, sections, nav highlights */
  clearAll(): void {
    if (this._autoClearTimer) {
      clearTimeout(this._autoClearTimer);
      this._autoClearTimer = null;
    }
    for (const el of this._activeElements) el.classList.remove(HIGHLIGHT_CLASS);
    for (const el of this._activeSections) el.classList.remove(SECTION_GLOW_CLASS);
    for (const el of this._activeNavItems) el.classList.remove(NAV_HIGHLIGHT_CLASS);
    this._activeElements = [];
    this._activeSections = [];
    this._activeNavItems = [];
    removeTooltip();
    this.deactivatePageGlow();
  }

  /**
   * THE KEY METHOD: Parse speech text and auto-highlight matching elements.
   * Page glow stays active for the entire duration Jarvis speaks.
   */
  autoSpotlight(speechText: string): void {
    if (!speechText) return;
    this.clearAll();

    const lower = speechText.toLowerCase();
    const matchedTargets: string[] = [];
    const matchedSections: string[] = [];
    const matchedNavs: string[] = [];

    for (const mapping of autoSpotlightMap) {
      const matched = mapping.keywords.some((kw) => lower.includes(kw));
      if (!matched) continue;
      matchedTargets.push(...mapping.targets);
      if (mapping.sections) matchedSections.push(...mapping.sections);
      if (mapping.navTargets) matchedNavs.push(...mapping.navTargets);
    }

    // Page glow always on while Jarvis speaks
    this.activatePageGlow();

    // Highlight sections (gentler)
    for (const s of [...new Set(matchedSections)]) {
      this.highlightSection(s);
    }

    // Highlight nav items
    for (const n of [...new Set(matchedNavs)]) {
      this.highlightNav(n);
    }

    // Highlight specific elements
    if (matchedTargets.length > 0) {
      this.highlightMany([...new Set(matchedTargets)], 5000);
    }

    // Auto-clear after 5s (except page glow which clears on speech end)
    this._scheduleAutoClear(5000);
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
