import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || profile.role !== "admin") redirect("/auth/login?redirect=/admin/dashboard");

  return <AdminShell fullName={profile.full_name}>{children}</AdminShell>;
}
