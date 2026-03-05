import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface JarvisMessage {
  role: "user" | "assistant";
  content: string;
  /** If true, Jarvis is asking user to confirm an action */
  awaitingConfirmation?: boolean;
  /** Whether this was a successful action result */
  isSuccess?: boolean;
  /** Navigation path if Jarvis wants to navigate */
  navigateTo?: string;
}

const TIMEOUT_MS = 30_000;
const MAX_CONTEXT_MESSAGES = 20;

export function useJarvis() {
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();

  const userFirstName = user?.user_metadata?.first_name || 
    user?.user_metadata?.full_name?.split(" ")[0] || "";

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

        const isConfirmation =
          /\b(confirm|shall I|should I|would you like me to|proceed|go ahead|is that correct)\b/i.test(
            responseText
          );

        const isSuccess =
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
          },
        ]);
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
    [messages, userFirstName]
  );

  const clearHistory = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearHistory, userFirstName };
}
