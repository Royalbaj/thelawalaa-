// ⚠️ SERVICE ROLE CLIENT — bypasses RLS entirely.
// Import ONLY from server actions / route handlers, never client components.
// "server-only" makes the build FAIL if this leaks into client code.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/** Append-only audit trail. Never exposed to any client. */
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
