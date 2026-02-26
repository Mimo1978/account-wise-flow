import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Check rate limit for a user on a specific function.
 * Uses hourly windows stored in edge_function_rate_limits table.
 */
export async function checkRateLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  functionName: string,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const windowStart = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()
  ).toISOString();

  const { data: existing } = await supabaseAdmin
    .from("edge_function_rate_limits")
    .select("request_count")
    .eq("user_id", userId)
    .eq("function_name", functionName)
    .eq("window_start", windowStart)
    .maybeSingle();

  if (existing) {
    if (existing.request_count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    await supabaseAdmin
      .from("edge_function_rate_limits")
      .update({ request_count: existing.request_count + 1 })
      .eq("user_id", userId)
      .eq("function_name", functionName)
      .eq("window_start", windowStart);
    return { allowed: true, remaining: maxRequests - existing.request_count - 1 };
  }

  await supabaseAdmin
    .from("edge_function_rate_limits")
    .insert({
      user_id: userId,
      function_name: functionName,
      window_start: windowStart,
      request_count: 1,
    });

  return { allowed: true, remaining: maxRequests - 1 };
}
