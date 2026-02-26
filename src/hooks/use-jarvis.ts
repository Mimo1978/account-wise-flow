import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

export interface JarvisMessage {
  role: "user" | "assistant";
  content: string;
}

export function useJarvis() {
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (userMessage: string) => {
    const userMsg: JarvisMessage = { role: "user", content: userMessage };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("jarvis-assistant", {
        body: {
          user_message: userMessage,
          conversation_history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      if (error) throw error;

      if (data?.error === "integration_not_configured") {
        toast.error(data.message || "Jarvis is not configured. Go to Settings > Integrations.");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message || "I'm not configured yet. Please add your Anthropic API key in Settings > Integrations." },
        ]);
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch (e) {
      console.error("Jarvis error:", e);
      const errMsg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(`Jarvis error: ${errMsg}`);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clearHistory = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearHistory };
}
