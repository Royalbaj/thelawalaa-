import { requireRole } from "@/lib/supabase/server";
import { getMarketing } from "@/lib/marketing";
import MarketingView from "@/components/admin/marketing/marketing-view";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  await requireRole(["super_admin"]);
  return <MarketingView d={await getMarketing()} />;
}
