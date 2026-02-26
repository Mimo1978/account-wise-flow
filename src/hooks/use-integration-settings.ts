import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface IntegrationSetting {
  id: string;
  user_id: string;
  service: string;
  key_name: string;
  key_value: string;
  is_configured: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntegrationStatus {
  user_id: string;
  service: string;
  is_fully_configured: boolean;
}

const TABLE = "integration_settings";
function fromTable() { return supabase.from(TABLE as any); }
function fromStatusView() { return supabase.from("integration_status" as any); }

/** Returns integration_settings rows for the current user (key_value is present but masked client-side) */
export function useIntegrationSettings(service?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["integration_settings", user?.id, service],
    queryFn: async () => {
      if (!user) return [];
      let q = fromTable().select("id, user_id, service, key_name, is_configured, created_at, updated_at").eq("user_id", user.id);
      if (service) q = q.eq("service", service);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Omit<IntegrationSetting, "key_value">[];
    },
    enabled: !!user,
  });
}

/** Returns integration status for the current user */
export function useIntegrationStatus(service?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["integration_status", user?.id, service],
    queryFn: async () => {
      if (!user) return [];
      let q = fromStatusView().select("*").eq("user_id", user.id);
      if (service) q = q.eq("service", service);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as IntegrationStatus[];
    },
    enabled: !!user,
  });
}

/** Check a single service status */
export function useIsServiceConfigured(service: string) {
  const { data, isLoading } = useIntegrationStatus(service);
  const status = data?.find(s => s.service === service);
  return { isConfigured: status?.is_fully_configured ?? false, isLoading };
}

/** Upsert integration keys — only saves non-empty values */
export function useSaveIntegrationKeys() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (keys: { service: string; key_name: string; key_value: string }[]) => {
      if (!user) throw new Error("Not authenticated");
      const nonEmpty = keys.filter(k => k.key_value.trim() !== "");
      if (nonEmpty.length === 0) return;

      for (const key of nonEmpty) {
        const { error } = await fromTable().upsert(
          {
            user_id: user.id,
            service: key.service,
            key_name: key.key_name,
            key_value: key.key_value.trim(),
            is_configured: true,
          } as any,
          { onConflict: "user_id,service,key_name" }
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration_settings"] });
      qc.invalidateQueries({ queryKey: ["integration_status"] });
    },
  });
}
