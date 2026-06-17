import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || !["pos_user", "admin"].includes(profile.role)) redirect("/auth/login?redirect=/pos");
  return (
    <div className="min-h-screen bg-brand-cream">
      <header className="flex items-center justify-between border-b border-orange-100 bg-brand-dark px-4 py-3">
        <span className="font-display font-bold brand-gradient-text">Thelawalaa POS</span>
        <span className="text-sm font-bold text-white/80">{profile.full_name}</span>
      </header>
      {children}
    </div>
  );
}
