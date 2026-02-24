import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export type SubscriptionTier = "free" | "starter" | "professional" | "premium";

export interface PremiumStatus {
  tier: SubscriptionTier;
  isPremium: boolean;
  isProfessionalOrAbove: boolean;
  isStarterOrAbove: boolean;
  expiresAt?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function usePremiumStatus(): PremiumStatus & { isLoading: boolean } {
  const { currentWorkspace } = useWorkspace();

  const { data, isLoading } = useQuery({
    queryKey: ["premium-status", currentWorkspace?.id],
    enabled: !!currentWorkspace?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("teams")
        .select("subscription_tier, subscription_expires_at")
        .eq("id", currentWorkspace!.id)
        .single();

      if (error) throw error;

      const tier = (data?.subscription_tier ?? "free") as SubscriptionTier;
      const expiresAt = data?.subscription_expires_at;
      const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
      const effectiveTier = isExpired ? "free" : tier;

      return {
        tier: effectiveTier,
        isPremium: effectiveTier === "premium",
        isProfessionalOrAbove: ["professional", "premium"].includes(effectiveTier),
        isStarterOrAbove: ["starter", "professional", "premium"].includes(effectiveTier),
        expiresAt,
      };
    },
  });

  return {
    tier: data?.tier ?? "free",
    isPremium: data?.isPremium ?? false,
    isProfessionalOrAbove: data?.isProfessionalOrAbove ?? false,
    isStarterOrAbove: data?.isStarterOrAbove ?? false,
    expiresAt: data?.expiresAt,
    isLoading,
  };
}
