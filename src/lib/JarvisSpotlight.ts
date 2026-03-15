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
/*  Settings interface (mirrors relevant JarvisSettings fields)        */
/* ------------------------------------------------------------------ */

interface SpotlightSettings {
  spotlight_enabled: boolean;
  page_glow_enabled: boolean;
  tooltip_labels_enabled: boolean;
}

const DEFAULT_SETTINGS: SpotlightSettings = {
  spotlight_enabled: true,
  page_glow_enabled: true,
  tooltip_labels_enabled: true,
};

/* ------------------------------------------------------------------ */
/*  Keyword → target map                                               */
/* ------------------------------------------------------------------ */

interface SpotlightMapping {
  keywords: string[];
  targets: string[];
  sections?: string[];
  navTargets?: string[];
  section?: "page";
}

const autoSpotlightMap: SpotlightMapping[] = [
  { keywords: ["home page", "command centre", "command center", "heartbeat"], targets: [], navTargets: ["nav-home"], section: "page" },
  { keywords: ["pipeline", "deal pipeline", "pipeline snapshot"], targets: ["home-pipeline-snapshot"], sections: ["pipeline-snapshot"] },
  { keywords: ["action required", "attention today"], targets: ["home-action-required"], sections: ["action-required"] },
  { keywords: ["diary", "seven days", "next 7 days"], targets: ["home-diary"], sections: ["diary"] },
  { keywords: ["add company", "new company"], targets: ["add-company-button"] },
  { keywords: ["companies"], targets: [], navTargets: ["nav-companies"] },
  { keywords: ["accounts", "accounts tab", "accounts & billing", "billing hub"], targets: ["home-outstanding-invoices-card", "accounts-create-invoice-button"], navTargets: ["nav-accounts"] },
  { keywords: ["contacts"], targets: [], navTargets: ["nav-contacts"] },
  { keywords: ["canvas", "org chart"], targets: [], navTargets: ["nav-canvas"] },
  { keywords: ["talent", "candidates"], targets: [], navTargets: ["nav-talent"] },
  { keywords: ["jobs", "job board"], targets: [], navTargets: ["nav-jobs"] },
  { keywords: ["outreach", "campaigns"], targets: [], navTargets: ["nav-outreach"] },
  { keywords: ["insights", "revenue intelligence"], targets: [], navTargets: ["nav-insights"] },
  { keywords: ["admin", "settings"], targets: [], navTargets: ["nav-admin"] },
  { keywords: ["billing", "invoices", "outstanding", "outstanding invoices", "invoice"], targets: ["home-outstanding-invoices-card", "accounts-create-invoice-button"] },
  { keywords: ["active projects", "live engagements"], targets: ["home-active-projects"], sections: ["active-projects"], navTargets: ["nav-projects"] },
  { keywords: ["outreach stats", "campaign performance", "active outreach"], targets: [], sections: ["active-outreach"] },
  { keywords: ["shortlist"], targets: ["job-tab-shortlist"], sections: ["job-shortlist-table"] },
  { keywords: ["adverts", "job adverts"], targets: ["job-tab-adverts"], sections: ["job-adverts-list"] },
  { keywords: ["applications"], targets: ["job-tab-applications"], sections: ["job-applications-table"] },
  { keywords: ["generate spec", "job spec"], targets: ["job-generate-spec-button"] },
  { keywords: ["run shortlist"], targets: ["job-run-shortlist-button"] },
  { keywords: ["add contact", "new contact"], targets: ["add-contact-button"] },
  { keywords: ["add candidate"], targets: ["add-candidate-button"] },
  { keywords: ["refresh"], targets: ["home-refresh-button"] },
  { keywords: ["create invoice"], targets: ["accounts-create-invoice-button", "home-outstanding-invoices-card"] },
  { keywords: ["stat cards", "top cards", "overview cards", "top-line", "headline numbers", "four cards"], targets: ["home-kpi-row"], sections: ["stat-cards"] },
  { keywords: ["alerts", "billing alerts", "overdue or expiring"], targets: ["home-alerts-strip"], sections: ["alerts-strip"] },
  { keywords: ["sows", "contracts", "statements of work"], targets: [], sections: ["sows-contracts"] },
  { keywords: ["outreach stats", "queued", "contacted", "responded", "booked"], targets: [], sections: ["outreach-stats"] },
  { keywords: ["pull report", "report builder"], targets: ["pull-report"] },
  { keywords: ["take the tour", "guided tour"], targets: ["home-tour-button"] },
  { keywords: ["job brief"], targets: [], sections: ["job-brief-box"] },
  // Tab spotlights
  { keywords: ["target queue"], targets: ["outreach-tab-queue"] },
  { keywords: ["campaigns tab"], targets: ["outreach-tab-campaigns"] },
  { keywords: ["scripts tab", "call scripts"], targets: ["outreach-tab-scripts"] },
  { keywords: ["new campaign", "create campaign"], targets: ["new-campaign-button"] },
  { keywords: ["new script", "create script"], targets: ["new-script-button"] },
  { keywords: ["add targets"], targets: ["add-targets-button"] },
  // CRM navigation spotlights
  { keywords: ["deals", "deal list", "deal page"], targets: [], navTargets: ["nav-crm-deals"] },
  { keywords: ["crm", "sales"], targets: [], navTargets: ["nav-crm"] },
  { keywords: ["projects"], targets: [], navTargets: ["nav-projects"] },
  // Integration/setup spotlights
  { keywords: ["integrations", "api keys", "resend", "twilio", "elevenlabs"], targets: ["admin-integrations"], navTargets: ["nav-admin"] },
  { keywords: ["email setup", "configure email", "set up email"], targets: ["admin-integrations"] },
  { keywords: ["sms setup", "configure sms", "set up sms", "text messages"], targets: ["admin-integrations"] },
  { keywords: ["ai calling", "ai calls", "voice calls", "configure calls"], targets: ["admin-integrations"] },
  { keywords: ["workspace", "team management", "invite", "roles"], targets: ["admin-workspace-roles"] },
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
  private _autoElements: HTMLElement[] = [];     // auto-spotlight managed separately
  private _autoSections: HTMLElement[] = [];
  private _autoNavItems: HTMLElement[] = [];
  private _settings: SpotlightSettings = { ...DEFAULT_SETTINGS };

  /** Update settings — called from React when workspace settings load */
  configure(settings: Partial<SpotlightSettings>): void {
    this._settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  /** Scroll element into view if not already fully visible */
  private _scrollTo(el: HTMLElement, isSection = false): void {
    const rect = el.getBoundingClientRect();
    if (isSection) {
      const targetTop = 120;
      if (rect.top < targetTop || rect.top > window.innerHeight - 80) {
        window.scrollBy({ top: rect.top - targetTop, behavior: "smooth" });
      }
    } else {
      const isFullyVisible = rect.top >= 80 && rect.bottom <= window.innerHeight - 80;
      if (!isFullyVisible) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  /** Highlight a single element by its data-jarvis-id */
  highlight(id: string, label?: string, duration = 4000): void {
    if (!this._settings.spotlight_enabled) return;
    const el = findEl(id);
    if (!el) return;
    this._scrollTo(el);
    el.classList.add(HIGHLIGHT_CLASS);
    this._activeElements.push(el);
    if (label && this._settings.tooltip_labels_enabled) showTooltipAbove(el, label);
    this._emitHighlightEvent(el);
    this._scheduleAutoClear(duration);
  }

  /** Highlight multiple targets at once */
  highlightMany(ids: string[], duration = 4000): void {
    if (!this._settings.spotlight_enabled) return;
    let firstEl: HTMLElement | null = null;
    for (const id of ids) {
      const el = findEl(id);
      if (!el) continue;
      el.classList.add(HIGHLIGHT_CLASS);
      this._activeElements.push(el);
      if (!firstEl) firstEl = el;
    }
    // Scroll to and emit dodge event for the first element
    if (firstEl) {
      this._scrollTo(firstEl);
      this._emitHighlightEvent(firstEl);
    }
    this._scheduleAutoClear(duration);
  }

  /** Highlight a section (gentler glow) + emit dodge event */
  highlightSection(sectionName: string, _label?: string): void {
    if (!this._settings.spotlight_enabled) return;
    const el = findSection(sectionName);
    if (!el) return;
    this._scrollTo(el, true);
    el.classList.add(SECTION_GLOW_CLASS);
    this._activeSections.push(el);
    this._emitHighlightEvent(el);
  }

  /** Highlight a nav item with background glow + emit dodge event */
  highlightNav(navId: string): void {
    if (!this._settings.spotlight_enabled) return;
    const el = findEl(navId);
    if (!el) return;
    el.classList.add(NAV_HIGHLIGHT_CLASS);
    this._activeNavItems.push(el);
    this._emitHighlightEvent(el);
  }

  /** Activate full page border glow */
  activatePageGlow(): void {
    if (!this._settings.spotlight_enabled || !this._settings.page_glow_enabled) return;
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
    // Also clear auto-spotlight items
    this._clearAutoOnly();
    removeTooltip();
    this.deactivatePageGlow();
    // Notify chat panel to restore position
    window.dispatchEvent(new CustomEvent("jarvis-highlight-clear"));
  }

  /** Clear ONLY auto-spotlight items (preserves tour/explicit highlights) */
  private _clearAutoOnly(): void {
    for (const el of this._autoElements) el.classList.remove(HIGHLIGHT_CLASS);
    for (const el of this._autoSections) el.classList.remove(SECTION_GLOW_CLASS);
    for (const el of this._autoNavItems) el.classList.remove(NAV_HIGHLIGHT_CLASS);
    this._autoElements = [];
    this._autoSections = [];
    this._autoNavItems = [];
  }

  /**
   * THE KEY METHOD: Parse speech text and auto-highlight matching elements.
   * Page glow stays active for the entire duration Jarvis speaks.
   * @param noAutoClear — when true, highlights persist until manually cleared (used by guided tours)
   */
  autoSpotlight(speechText: string, noAutoClear = false): void {
    if (!speechText || !this._settings.spotlight_enabled) return;
    
    // Only clear previous auto-spotlight items — NOT tour-managed explicit highlights
    this._clearAutoOnly();

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

    // Highlight sections (gentler) — tracked as auto items
    for (const s of [...new Set(matchedSections)]) {
      const el = findSection(s);
      if (!el) continue;
      this._scrollTo(el, true);
      el.classList.add(SECTION_GLOW_CLASS);
      this._autoSections.push(el);
      this._emitHighlightEvent(el);
    }

    // Highlight nav items — tracked as auto items
    for (const n of [...new Set(matchedNavs)]) {
      const el = findEl(n);
      if (!el) continue;
      el.classList.add(NAV_HIGHLIGHT_CLASS);
      this._autoNavItems.push(el);
      this._emitHighlightEvent(el);
    }

    // Highlight specific elements — tracked as auto items
    const uniqueTargets = [...new Set(matchedTargets)];
    let firstAutoEl: HTMLElement | null = null;
    for (const id of uniqueTargets) {
      const el = findEl(id);
      if (!el) continue;
      el.classList.add(HIGHLIGHT_CLASS);
      this._autoElements.push(el);
      if (!firstAutoEl) firstAutoEl = el;
    }
    if (firstAutoEl) {
      this._scrollTo(firstAutoEl);
      this._emitHighlightEvent(firstAutoEl);
    }

    // Auto-clear after 5s unless tour mode
    if (!noAutoClear) {
      this._scheduleAutoClear(5000);
    }
  }

  /* ---- private ---- */
  /** Emit a custom event so the Jarvis panel can auto-dodge */
  private _emitHighlightEvent(el: HTMLElement): void {
    const rect = el.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent("jarvis-highlight", { detail: { rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } } }));
  }

  private _scheduleAutoClear(duration: number): void {
    if (this._autoClearTimer) clearTimeout(this._autoClearTimer);
    this._autoClearTimer = setTimeout(() => {
      this.clearAll();
    }, duration);
  }
}

/** Global singleton — import and use from anywhere */
export const jarvisSpotlight = new JarvisSpotlightManager();
