import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SITE_TEXT_SECTIONS } from "@/lib/site-content";
import SiteTextEditor from "@/components/admin/site-text-editor";

export const dynamic = "force-dynamic";

export default async function WebsiteTextPage() {
  await requireRole(["super_admin"]);
  const { data } = await supabaseAdmin.from("site_content").select("key, value");
  const saved = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return <SiteTextEditor sections={SITE_TEXT_SECTIONS} saved={saved} />;
}
