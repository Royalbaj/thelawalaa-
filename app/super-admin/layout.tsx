import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import SuperAdminShell from "@/components/super-admin/shell";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || profile.role !== "super_admin") redirect("/auth/login?redirect=/super-admin");

  return <SuperAdminShell fullName={profile.full_name}>{children}</SuperAdminShell>;
}
