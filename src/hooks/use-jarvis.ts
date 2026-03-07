import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

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
};

export function useJarvis() {
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
        const { data, error } = await supabase.functions.invoke(
          "jarvis-assistant",
          {
            body: {
              user_message: userMessage,
              conversation_history: contextMessages.slice(0, -1),
              user_first_name: userFirstName,
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

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: responseText,
            awaitingConfirmation: isConfirmation,
            isSuccess,
            navigateTo: data.navigate_to || undefined,
            targetAction: data.target_action || undefined,
            targetId: data.target_id || undefined,
            actionsExecuted,
            invalidateQueries: invalidateQueryKeys,
            guidedTour: data.guided_tour || undefined,
            suggestions: data.suggestions || undefined,
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
    [messages, userFirstName, queryClient]
  );

  const clearHistory = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearHistory, userFirstName };
}
