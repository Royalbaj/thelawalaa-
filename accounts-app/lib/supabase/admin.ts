import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Only ever used after requireAuth().
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function audit(entry: {
  actor_id: string | null;
  action: string;
  target_table?: string;
  target_id?: string | null;
  old_data?: unknown;
  new_data?: unknown;
}) {
  await supabaseAdmin.from("audit_logs").insert(entry as never);
}
