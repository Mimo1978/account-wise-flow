import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface DeletionRequestBannerProps {
  recordType: string;
  recordId: string;
}

export function DeletionRequestBanner({ recordType, recordId }: DeletionRequestBannerProps) {
  const { data: request } = useQuery({
    queryKey: ["deletion_request_for", recordType, recordId],
    queryFn: async () => {
      const { data } = await supabase
        .from("deletion_requests" as any)
        .select("*")
        .eq("record_type", recordType)
        .eq("record_id", recordId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(1);
      const row = (data as any)?.[0] || null;
      return row as { requested_at: string; reason: string } | null;
    },
  });

  if (!request) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-2.5 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-amber-800 dark:text-amber-200">
        <strong>Deletion requested</strong> on{" "}
        {format(new Date(request.requested_at), "dd MMM yyyy")}
        {request.reason && <> — "{request.reason}"</>}
      </span>
    </div>
  );
}
