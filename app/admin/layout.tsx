import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import SidebarNav from "@/components/admin/sidebar-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware already gates /admin — this is defense in depth.
  const { profile } = await getVerifiedUser();
  if (!profile || profile.role !== "admin") redirect("/auth/login?redirect=/admin");

  return (
    <div className="flex min-h-screen bg-brand-cream">
      <aside className="sticky top-0 h-screen w-16 shrink-0 bg-brand-dark md:w-60">
        <div className="px-4 py-5">
          <span className="font-display text-lg font-bold brand-gradient-text hidden md:inline">Thelawalaa</span>
          <span className="font-display text-lg font-bold brand-gradient-text md:hidden">T</span>
        </div>
        <SidebarNav />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="border-b border-orange-100 bg-white px-6 py-4">
          <p className="text-sm text-stone-500">Admin console</p>
          <p className="font-display font-bold text-brand-brown">Hi, {profile.full_name} 👋</p>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
