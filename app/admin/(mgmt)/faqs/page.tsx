import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import FaqControls from "@/components/admin/faq-controls";

export const dynamic = "force-dynamic";

export default async function FaqsPage() {
  await requireRole(["admin"]);
  const { data: faqs } = await supabaseAdmin
    .from("faqs")
    .select("id, question, answer, is_active")
    .order("sort_order");

  return <FaqControls faqs={(faqs ?? []) as never} />;
}
