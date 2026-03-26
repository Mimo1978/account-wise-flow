import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getJarvisNavHistory } from "@/hooks/use-jarvis-navigation";
import type { ConfirmCardData } from "@/components/jarvis/JarvisConfirmationCard";

export interface JarvisAction {
  tool: string;
  entityType: string;
  entityId?: string;
  success: boolean;
}

export interface GuidedTourStep {
  navigate?: string;
  highlight?: string;
  click?: string;
  clickAndOpen?: string;
  speak?: string;
  delay?: number;
}

export interface JarvisSuggestion {
  label: string;
  destination: string;
  isMenu?: boolean;
}

export interface JarvisActionPayload {
  type: 'NAVIGATE' | 'GUIDED_TOUR' | 'HIGHLIGHT' | 'CLICK' | 'CREATE' | 'SHOW_MENU' | 'NONE';
  destination?: string;
  highlight?: string;
  label?: string;
  steps?: GuidedTourStep[];
  intent?: string;
  fields?: Record<string, unknown>;
  options?: string[];
}

export type JarvisFlowType = 'CREATE_COMPANY' | 'CREATE_CONTACT' | 'LOG_CALL' | 'CREATE_DEAL' | 'CREATE_JOB_SPEC' | null;

export interface JarvisFlowState {
  flow: JarvisFlowType;
  collectedFields: Record<string, any>;
  currentQuestion: number;
  awaitingConfirmation: boolean;
}

/* ------------------------------------------------------------------ */
/*  Session entity memory                                              */
/* ------------------------------------------------------------------ */
export interface JarvisEntityRef {
  type: 'company' | 'contact' | 'deal' | 'project' | 'opportunity';
  id: string;
  name: string;
  timestamp: number;
  /** For companies: also store the CRM-side ID */
  crmId?: string;
}

export interface JarvisContext {
  lastCreated: JarvisEntityRef | null;
  recentEntities: JarvisEntityRef[];
}

const INITIAL_CONTEXT: JarvisContext = { lastCreated: null, recentEntities: [] };
const MAX_RECENT = 10;

function addEntity(ctx: JarvisContext, entity: JarvisEntityRef): JarvisContext {
  const recent = [entity, ...ctx.recentEntities.filter(e => e.id !== entity.id)].slice(0, MAX_RECENT);
  return { lastCreated: entity, recentEntities: recent };
}

/** Build a text summary of session context for the system prompt */
function contextToPromptLines(ctx: JarvisContext): string {
  if (ctx.recentEntities.length === 0) return "";
  const lines = ctx.recentEntities.map(e => {
    let line = `${e.type} "${e.name}" id=${e.id}`;
    if (e.crmId) line += ` crm_id=${e.crmId}`;
    return line;
  });
  return `SESSION ENTITY MEMORY (use these IDs — do NOT re-lookup):\n${lines.join("\n")}`;
}

const FLOW_FIELD_MAP: Record<string, { fields: string[]; highlightIds: string[] }> = {
  CREATE_COMPANY: {
    fields: ['name', 'industry', 'relationship_status', 'notes'],
    highlightIds: ['company-name-input', 'company-industry-select', 'company-status-select', 'notes-input'],
  },
  CREATE_CONTACT: {
    fields: ['name', 'company', 'job_title', 'email', 'phone', 'gdpr_consent', 'notes'],
    highlightIds: ['contact-first-name-input', 'contact-company-select', '', 'contact-email-input', 'contact-phone-input', '', 'notes-input'],
  },
  LOG_CALL: {
    fields: ['contact', 'outcome', 'notes', 'follow_up'],
    highlightIds: ['', '', 'notes-input', ''],
  },
  CREATE_DEAL: {
    fields: ['company', 'name', 'value', 'stage', 'close_date'],
    highlightIds: ['', 'deal-name-input', 'deal-value-input', 'deal-stage-select', 'deal-close-date-input'],
  },
  CREATE_JOB_SPEC: {
    fields: ['brief', 'title', 'company', 'type'],
    highlightIds: ['', '', '', ''],
  },
};

function detectFlowFromResponse(text: string, currentFlow: JarvisFlowState): JarvisFlowState {
  const lower = text.toLowerCase();

  if (!currentFlow.flow) {
    if (/what('s| is) the company name|let('s| me) create a company|i'll add .* company/i.test(text)) {
      return { flow: 'CREATE_COMPANY', collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };
    }
    if (/what('s| is) their (full |first )?name|let('s| me) create a contact|i'll add .* contact/i.test(text)) {
      return { flow: 'CREATE_CONTACT', collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };
    }
    if (/who did you speak with|let('s| me) log (a |that )?call/i.test(text)) {
      return { flow: 'LOG_CALL', collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };
    }
    if (/which company is this deal|let('s| me) create a deal/i.test(text)) {
      return { flow: 'CREATE_DEAL', collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };
    }
    if (/tell me about the role|i'll build the full spec|let('s| me) (write|create|build) a job spec|new (job|role|requirement)/i.test(text)) {
      return { flow: 'CREATE_JOB_SPEC', collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };
    }
  }

  if (!currentFlow.flow) return currentFlow;

  const isConfirmation = /shall I (save|go ahead|create|proceed)|is that correct|confirm|ready to save/i.test(text);
  if (isConfirmation) {
    return { ...currentFlow, awaitingConfirmation: true };
  }

  const isComplete = /has been (added|created|saved|logged)|successfully (created|added|logged|saved)/i.test(text);
  if (isComplete) {
    return { flow: null, collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };
  }

  if (/cancelled|aborted|let me know if you'd like to start over/i.test(text)) {
    return { flow: null, collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };
  }

  const flowConfig = FLOW_FIELD_MAP[currentFlow.flow];
  if (flowConfig) {
    const fields = flowConfig.fields;
    let maxQ = currentFlow.currentQuestion;
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (lower.includes(field) || (field === 'name' && /what('s| is).*name/i.test(text))) {
        maxQ = Math.max(maxQ, i);
      }
    }
    if (maxQ !== currentFlow.currentQuestion) {
      return { ...currentFlow, currentQuestion: maxQ };
    }
  }

  return currentFlow;
}

export function getFlowHighlightId(flowState: JarvisFlowState): string | null {
  if (!flowState.flow) return null;
  const config = FLOW_FIELD_MAP[flowState.flow];
  if (!config) return null;
  const id = config.highlightIds[flowState.currentQuestion];
  return id || null;
}

export interface JarvisMessage {
  role: "user" | "assistant";
  content: string;
  awaitingConfirmation?: boolean;
  isSuccess?: boolean;
  navigateTo?: string;
  targetAction?: "click";
  targetId?: string;
  actionsExecuted?: JarvisAction[];
  invalidateQueries?: string[];
  guidedTour?: GuidedTourStep[];
  suggestions?: JarvisSuggestion[];
  actionPayload?: JarvisActionPayload;
  /** Inline confirmation card data */
  confirmCard?: ConfirmCardData;
  /** Duplicate matches from search-first flow */
  duplicateMatches?: Array<{ id: string; name: string; location?: string }>;
}

const TIMEOUT_MS = 30_000;
const MAX_CONTEXT_MESSAGES = 20;

function stripIds(text: string): string {
  let cleaned = text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
  cleaned = cleaned.replace(/\b(record\s*(number|id)|ID)\s*[:=]?\s*,?\s*/gi, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
  return cleaned;
}

const ENTITY_QUERY_KEY_MAP: Record<string, string[]> = {
  companies: ['companies', 'canvas-companies', 'crm_companies'],
  contacts: ['contacts', 'company-contacts', 'all-contacts', 'crm_contacts'],
  crm_companies: ['crm_companies', 'companies'],
  crm_contacts: ['crm_contacts', 'all-contacts', 'contacts'],
  crm_deals: ['crm_deals'],
  crm_opportunities: ['crm_opportunities'],
  crm_projects: ['crm_projects', 'engagements'],
  crm_invoices: ['crm_invoices', 'invoices'],
  crm_activities: ['crm_activities'],
  candidates: ['candidates', 'talent'],
  engagements: ['engagements', 'crm_projects'],
  sows: ['sows'],
  outreach_campaigns: ['outreach_campaigns'],
  outreach_targets: ['outreach_targets'],
  notes: ['contact-notes', 'company-notes'],
  jobs: ['jobs'],
  job_adverts: ['job_adverts'],
  job_shortlist: ['job_shortlist'],
};

const INITIAL_FLOW_STATE: JarvisFlowState = { flow: null, collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };

export function useJarvis() {
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flowState, setFlowState] = useState<JarvisFlowState>(INITIAL_FLOW_STATE);
  const [entityContext, setEntityContext] = useState<JarvisContext>(INITIAL_CONTEXT);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const [userFirstName, setUserFirstName] = useState("");
  const [userPreferredName, setUserPreferredName] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles" as any)
      .select("first_name, preferred_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const fn = (data as any).first_name || user.user_metadata?.first_name || user.user_metadata?.full_name?.split(" ")[0] || "";
          const pn = (data as any).preferred_name || "";
          setUserFirstName(fn);
          setUserPreferredName(pn);
        } else {
          const metaName = user.user_metadata?.first_name || user.user_metadata?.full_name?.split(" ")[0] || "";
          setUserFirstName(metaName);
        }
      });
  }, [user]);

  /** Register a created entity into session memory */
  const registerEntity = useCallback((entity: JarvisEntityRef) => {
    setEntityContext(prev => addEntity(prev, entity));
    console.log("[Jarvis] Entity registered:", entity.type, entity.name, entity.id);
  }, []);

  /** Direct save from a confirmation card — calls Supabase and registers the entity */
  const saveFromCard = useCallback(async (
    cardType: ConfirmCardData["cardType"],
    fields: Record<string, string>,
    resolvedIds?: Record<string, string>,
  ): Promise<{ success: boolean; id?: string; name?: string; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-assistant", {
        body: {
          direct_save: true,
          card_type: cardType,
          fields,
          resolved_ids: resolvedIds,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const created = data?.created;
      if (created?.id) {
        const entity: JarvisEntityRef = {
          type: cardType,
          id: created.id,
          name: created.name || fields.name || `${fields.first_name || ''} ${fields.last_name || ''}`.trim(),
          timestamp: Date.now(),
          crmId: created.crm_id,
        };
        registerEntity(entity);

        // Invalidate relevant queries
        const keysToInvalidate = ENTITY_QUERY_KEY_MAP[created.entity_type] || ENTITY_QUERY_KEY_MAP[cardType + 's'] || [];
        for (const key of keysToInvalidate) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
        // Also invalidate the paired table queries
        if (cardType === 'company') {
          queryClient.invalidateQueries({ queryKey: ['companies'] });
          queryClient.invalidateQueries({ queryKey: ['crm_companies'] });
        }
      }

      return { success: true, id: created?.id, name: created?.name };
    } catch (e: any) {
      console.error("[Jarvis] Card save error:", e);
      return { success: false, error: e?.message || "Save failed" };
    }
  }, [registerEntity, queryClient]);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      const userMsg: JarvisMessage = { role: "user", content: userMessage };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const contextMessages = [...messages, userMsg]
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content }));

      abortRef.current = new AbortController();
      const timeout = setTimeout(() => abortRef.current?.abort(), TIMEOUT_MS);

      try {
        const navHistory = getJarvisNavHistory();
        const entityMemory = contextToPromptLines(entityContext);

        const { data, error } = await supabase.functions.invoke(
          "jarvis-assistant",
          {
            body: {
              user_message: userMessage,
              conversation_history: contextMessages.slice(0, -1),
              user_first_name: userFirstName,
              nav_history: navHistory.slice(-20).map(e => ({ path: e.path, label: e.label })),
              flow_state: flowState.flow ? flowState : undefined,
              entity_memory: entityMemory || undefined,
            },
          }
        );

        clearTimeout(timeout);

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const responseText: string = stripIds(data.response || "");
        const actionsExecuted: JarvisAction[] = data.actions_executed || [];
        const invalidateQueryKeys: string[] = data.invalidate_queries || [];

        // Update entity context from successful actions
        if (data.created_entities && Array.isArray(data.created_entities)) {
          for (const ce of data.created_entities) {
            if (ce.id && ce.name && ce.type) {
              registerEntity({
                type: ce.type,
                id: ce.id,
                name: ce.name,
                timestamp: Date.now(),
                crmId: ce.crm_id,
              });
            }
          }
        }

        // Invalidate React Query caches
        const allKeysToInvalidate = new Set<string>();
        for (const queryKey of invalidateQueryKeys) {
          const mapped = ENTITY_QUERY_KEY_MAP[queryKey];
          if (mapped) {
            mapped.forEach(k => allKeysToInvalidate.add(k));
          } else {
            allKeysToInvalidate.add(queryKey);
          }
        }
        for (const action of actionsExecuted) {
          if (action.success && action.entityType) {
            const mapped = ENTITY_QUERY_KEY_MAP[action.entityType];
            if (mapped) {
              mapped.forEach(k => allKeysToInvalidate.add(k));
            }
          }
        }
        if (allKeysToInvalidate.size > 0) {
          for (const key of allKeysToInvalidate) {
            queryClient.invalidateQueries({ queryKey: [key], exact: false });
          }
          console.log("[Jarvis] Invalidated queries (prefix match):", Array.from(allKeysToInvalidate));
        }

        const hasSuccessfulMutation = actionsExecuted.some(a => a.success);

        // Parse confirmation card from response
        let confirmCard: ConfirmCardData | undefined;
        if (data.confirm_card) {
          confirmCard = data.confirm_card as ConfirmCardData;
        }

        // Parse duplicate matches
        let duplicateMatches: JarvisMessage["duplicateMatches"];
        if (data.duplicate_matches) {
          duplicateMatches = data.duplicate_matches;
        }

        const isConfirmation =
          !hasSuccessfulMutation &&
          !confirmCard &&
          /\b(confirm|shall I|should I|would you like me to|proceed|go ahead|is that correct)\b/i.test(
            responseText
          );

        const isSuccess =
          hasSuccessfulMutation ||
          /\b(created|saved|sent|updated|done|successfully|added|logged)\b/i.test(
            responseText
          );

        const newFlowState = detectFlowFromResponse(responseText, flowState);
        setFlowState(newFlowState);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: responseText,
            awaitingConfirmation: isConfirmation || newFlowState.awaitingConfirmation,
            isSuccess,
            navigateTo: data.navigate_to || undefined,
            targetAction: data.target_action || undefined,
            targetId: data.target_id || undefined,
            actionsExecuted,
            invalidateQueries: invalidateQueryKeys,
            guidedTour: data.guided_tour || undefined,
            suggestions: data.suggestions || undefined,
            actionPayload: data.action || undefined,
            confirmCard,
            duplicateMatches,
          },
        ]);

        if (hasSuccessfulMutation) {
          const actionNames = actionsExecuted
            .filter(a => a.success)
            .map(a => a.tool.replace(/_/g, ' '))
            .join(', ');
          toast.success(`Jarvis completed: ${actionNames}`);
        }
      } catch (e: any) {
        clearTimeout(timeout);
        console.error("Jarvis error:", e);

        const isTimeout =
          e?.name === "AbortError" || e?.message?.includes("abort");
        const errText = isTimeout
          ? "Request timed out — please try again."
          : "Something went wrong — please try again.";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: errText },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, userFirstName, queryClient, flowState, entityContext, registerEntity]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    setFlowState(INITIAL_FLOW_STATE);
    setEntityContext(INITIAL_CONTEXT);
  }, []);

  const cancelFlow = useCallback(() => {
    setFlowState(INITIAL_FLOW_STATE);
  }, []);

  return {
    messages, isLoading, sendMessage, clearHistory,
    userFirstName, userPreferredName, flowState, cancelFlow,
    entityContext, registerEntity, saveFromCard,
    setMessages,
  };
}
