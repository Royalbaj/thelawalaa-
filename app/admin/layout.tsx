import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import PosHeader from "@/components/admin/pos-header";

export const dynamic = "force-dynamic";

// Deliberately minimal — no sidebar here. The POS terminal needs every
// pixel it can get on small screens; the full management shell lives
// only under /admin/(mgmt), which pos_user can't reach anyway.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || !["admin", "pos_user"].includes(profile.role)) {
    redirect("/auth/login?redirect=/admin");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-brand-cream">
      <PosHeader fullName={profile.full_name} isAdmin={profile.role === "admin"} />
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
