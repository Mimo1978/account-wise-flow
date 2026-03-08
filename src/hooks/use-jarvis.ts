import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getJarvisNavHistory } from "@/hooks/use-jarvis-navigation";

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

/** Detect if the AI response indicates a guided collection flow */
function detectFlowFromResponse(text: string, currentFlow: JarvisFlowState): JarvisFlowState {
  const lower = text.toLowerCase();

  // Detect new flow starting
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

  // Detect confirmation prompt
  const isConfirmation = /shall I (save|go ahead|create|proceed)|is that correct|confirm|ready to save/i.test(text);
  if (isConfirmation) {
    return { ...currentFlow, awaitingConfirmation: true };
  }

  // Detect flow completion (successful creation)
  const isComplete = /has been (added|created|saved|logged)|successfully (created|added|logged|saved)/i.test(text);
  if (isComplete) {
    return { flow: null, collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };
  }

  // Detect cancellation
  if (/cancelled|aborted|let me know if you'd like to start over/i.test(text)) {
    return { flow: null, collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };
  }

  // Advance question counter by detecting what Jarvis is asking about
  const flowConfig = FLOW_FIELD_MAP[currentFlow.flow];
  if (flowConfig) {
    const fields = flowConfig.fields;
    let maxQ = currentFlow.currentQuestion;
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      // If the response mentions collecting this field, we're at least at this step
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

/** Get the data-jarvis-id to highlight for the current flow step */
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
}

const TIMEOUT_MS = 30_000;
const MAX_CONTEXT_MESSAGES = 20;

/** Strip UUIDs (8-4-4-4-12 hex format) and long numeric IDs from Jarvis responses */
function stripIds(text: string): string {
  // Remove UUIDs
  let cleaned = text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
  // Remove orphaned labels like "record number ", "ID: ", "id: " left behind
  cleaned = cleaned.replace(/\b(record\s*(number|id)|ID)\s*[:=]?\s*,?\s*/gi, '');
  // Clean up extra whitespace and trailing commas/periods from removal
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
  return cleaned;
}

/** Map of entity types to all React Query keys that should be invalidated */
const ENTITY_QUERY_KEY_MAP: Record<string, string[]> = {
  companies: ['companies', 'canvas-companies'],
  crm_companies: ['crm_companies'],
  crm_contacts: ['crm_contacts'],
  crm_deals: ['crm_deals'],
  crm_opportunities: ['crm_opportunities'],
  crm_projects: ['crm_projects'],
  crm_invoices: ['crm_invoices'],
  crm_activities: ['crm_activities'],
  jobs: ['jobs'],
};

const INITIAL_FLOW_STATE: JarvisFlowState = { flow: null, collectedFields: {}, currentQuestion: 0, awaitingConfirmation: false };

export function useJarvis() {
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flowState, setFlowState] = useState<JarvisFlowState>(INITIAL_FLOW_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const [userFirstName, setUserFirstName] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const metaName = user.user_metadata?.first_name || user.user_metadata?.full_name?.split(" ")[0];
    if (metaName) {
      setUserFirstName(metaName);
      return;
    }
    supabase
      .from("profiles" as any)
      .select("first_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data && (data as any).first_name) {
          setUserFirstName((data as any).first_name);
        }
      });
  }, [user]);

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
        const { data, error } = await supabase.functions.invoke(
          "jarvis-assistant",
          {
            body: {
              user_message: userMessage,
              conversation_history: contextMessages.slice(0, -1),
              user_first_name: userFirstName,
              nav_history: navHistory.slice(-20).map(e => ({ path: e.path, label: e.label })),
              flow_state: flowState.flow ? flowState : undefined,
            },
          }
        );

        clearTimeout(timeout);

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Strip UUIDs from the response text
        const responseText: string = stripIds(data.response || "");
        const actionsExecuted: JarvisAction[] = data.actions_executed || [];
        const invalidateQueryKeys: string[] = data.invalidate_queries || [];

        // Invalidate React Query caches — expand entity types to all relevant query keys
        const allKeysToInvalidate = new Set<string>();
        for (const queryKey of invalidateQueryKeys) {
          const mapped = ENTITY_QUERY_KEY_MAP[queryKey];
          if (mapped) {
            mapped.forEach(k => allKeysToInvalidate.add(k));
          } else {
            allKeysToInvalidate.add(queryKey);
          }
        }

        // Also derive from actionsExecuted for comprehensive invalidation
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
            queryClient.invalidateQueries({ queryKey: [key] });
          }
          console.log("[Jarvis] Invalidated queries:", Array.from(allKeysToInvalidate));
        }

        const hasSuccessfulMutation = actionsExecuted.some(a => a.success);

        const isConfirmation =
          !hasSuccessfulMutation &&
          /\b(confirm|shall I|should I|would you like me to|proceed|go ahead|is that correct)\b/i.test(
            responseText
          );

        const isSuccess =
          hasSuccessfulMutation ||
          /\b(created|saved|sent|updated|done|successfully|added|logged)\b/i.test(
            responseText
          );

        // Update flow state based on response
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
    [messages, userFirstName, queryClient, flowState]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    setFlowState(INITIAL_FLOW_STATE);
  }, []);

  const cancelFlow = useCallback(() => {
    setFlowState(INITIAL_FLOW_STATE);
  }, []);

  return { messages, isLoading, sendMessage, clearHistory, userFirstName, flowState, cancelFlow };
}
