import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import SuperAdminSidebar from "@/components/super-admin/sidebar-nav";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || profile.role !== "super_admin") redirect("/auth/login?redirect=/super-admin");

  return (
    <div className="flex min-h-screen bg-stone-50">
      <aside className="sticky top-0 h-screen w-16 shrink-0 bg-stone-900 md:w-64 flex flex-col border-r border-stone-800">
        <div className="px-4 py-5 border-b border-white/10">
          <span className="font-display text-lg font-bold text-white hidden md:inline">🍜 Thelawalaa</span>
          <span className="font-display text-lg font-bold text-white md:hidden">🍜</span>
          <p className="hidden md:block text-[10px] text-amber-400/80 mt-0.5 font-bold uppercase tracking-wider">Super Admin</p>
        </div>
        <SuperAdminSidebar />
      </aside>
      <div className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-bold text-brand-brown">Super Admin Console 🔒</p>
            <p className="text-xs text-stone-400 font-medium">Full system access — {profile.full_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              ⚡ Super Admin
            </span>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
