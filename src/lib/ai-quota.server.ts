import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AI_DAILY_LIMIT } from "./launch-rules";

export async function consumeAiCall(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("consume_ai_call", { p_user_id: userId });
  if (error) throw new Error("Unable to check AI usage. Please try again.");
  if (!data) throw new Error(`Daily AI limit reached (${AI_DAILY_LIMIT} calls). Try again after midnight UTC.`);
}