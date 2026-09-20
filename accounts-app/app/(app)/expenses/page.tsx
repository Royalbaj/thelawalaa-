import { startOfMonth } from "date-fns";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import ExpensesManager from "@/components/expenses-manager";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  await requireAuth();
  const { data: expenses } = await supabaseAdmin
    .from("expenses")
    .select("id, category, description, amount, spent_at")
    .order("spent_at", { ascending: false })
    .limit(200);

  const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
  const total = (expenses ?? [])
    .filter((e) => e.spent_at >= monthStart)
    .reduce((s, e) => s + Number(e.amount), 0);

  return <ExpensesManager expenses={(expenses ?? []) as never} total={total} />;
}
