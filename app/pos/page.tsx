import { requireRole } from "@/lib/supabase/server";
import PosTerminal from "@/components/pos/pos-terminal";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  // Products/categories are read with the operator's OWN RLS session —
  // POS users get no privileged reads; writes go through createPosOrder.
  const { supabase } = await requireRole(["pos_user", "admin"]);
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("id, name, price, is_available, category_id").order("sort_order"),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);
  return <PosTerminal products={(products ?? []) as never} categories={(categories ?? []) as never} />;
}
