import { requireRole } from "@/lib/supabase/server";
import { getMarketing } from "@/lib/marketing";
import MarketingView from "@/components/admin/marketing/marketing-view";

export const dynamic = "force-dynamic";

export default async function MarketingPage(props: { searchParams: Promise<{ month?: string }> }) {
  await requireRole(["super_admin"]);
  const { month } = await props.searchParams;
  return <MarketingView d={await getMarketing(month)} />;
}
