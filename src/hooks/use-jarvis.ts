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

export interface JarvisMessage {
  role: "user" | "assistant";
  content: string;
  /** If true, Jarvis is asking user to confirm an action */
  awaitingConfirmation?: boolean;
  /** Whether this was a successful action result */
  isSuccess?: boolean;
  /** Navigation path if Jarvis wants to navigate */
  navigateTo?: string;
  /** Actions that were executed by the backend */
  actionsExecuted?: JarvisAction[];
  /** Query keys to invalidate in React Query */
  invalidateQueries?: string[];
}

const TIMEOUT_MS = 30_000;
const MAX_CONTEXT_MESSAGES = 20;

export function useJarvis() {
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const [userFirstName, setUserFirstName] = useState("");
  const queryClient = useQueryClient();

  // Fetch first name from profiles table
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

        if (data?.error) {
          throw new Error(data.error);
        }

        const responseText: string = data.response || "";
        const actionsExecuted: JarvisAction[] = data.actions_executed || [];
        const invalidateQueryKeys: string[] = data.invalidate_queries || [];

        // Invalidate React Query caches for mutated entities
        if (invalidateQueryKeys.length > 0) {
          for (const queryKey of invalidateQueryKeys) {
            queryClient.invalidateQueries({ queryKey: [queryKey] });
          }
          console.log("[Jarvis] Invalidated queries:", invalidateQueryKeys);
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
            actionsExecuted,
            invalidateQueries: invalidateQueryKeys,
          },
        ]);

        // Show toast for successful mutations
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
