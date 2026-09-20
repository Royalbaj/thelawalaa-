import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/role-home";
import StaffHeader from "@/components/staff/staff-header";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["pos_user", "delivery_driver", "admin"];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    redirect("/auth/login?redirect=/staff");
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <StaffHeader backHref={ROLE_HOME[profile.role] ?? "/"} />
      <main className="mx-auto max-w-2xl">{children}</main>
    </div>
  );
}
