import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import PosHeader from "@/components/admin/pos-header";

export const dynamic = "force-dynamic";

// Deliberately minimal — no sidebar here. The POS terminal needs every
// pixel it can get on small screens; the full management shell lives
// only under /admin/(mgmt).
//
// pos_user only — super_admin no longer has the POS terminal in their
// interface at all (not just hidden from the nav). Counter operations
// and business management are deliberately separate logins now.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || profile.role !== "pos_user") {
    redirect("/auth/login?redirect=/admin");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-brand-cream">
      <PosHeader fullName={profile.full_name} />
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
