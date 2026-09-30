import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/role-home";
import AdminShell from "@/components/admin/shell";
import SessionGuard from "@/components/session-guard";

export const dynamic = "force-dynamic";

export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile) redirect("/auth/login?redirect=/admin/dashboard");
  // pos_user shares the /admin prefix — send them to the POS, not to login.
  if (profile.role !== "super_admin") redirect(ROLE_HOME[profile.role] ?? "/unauthorized");

  return (
    <>
      <SessionGuard userId={profile.id} />
      <AdminShell fullName={profile.full_name}>{children}</AdminShell>
    </>
  );
}
