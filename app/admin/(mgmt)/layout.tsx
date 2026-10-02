import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/role-home";
import AdminShell from "@/components/admin/shell";
import { supabaseAdmin } from "@/lib/supabase/admin";
import SessionGuard from "@/components/session-guard";

export const dynamic = "force-dynamic";

export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile) redirect("/auth/login?redirect=/admin/dashboard");
  // pos_user shares the /admin prefix — send them to the POS, not to login.
  if (profile.role !== "super_admin") redirect(ROLE_HOME[profile.role] ?? "/unauthorized");

  // New customer feedback shows as a count beside Feedback in the menu.
  const { count: newFeedback } = await supabaseAdmin.from("feedback").select("id", { count: "exact", head: true }).eq("is_read", false);

  return (
    <>
      <SessionGuard userId={profile.id} />
      <AdminShell fullName={profile.full_name} badges={{ "/admin/feedback": newFeedback ?? 0 }}>{children}</AdminShell>
    </>
  );
}
