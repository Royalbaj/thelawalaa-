import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { getVerifiedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || !["delivery_driver", "super_admin"].includes(profile.role)) {
    redirect("/auth/login?redirect=/delivery");
  }

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      {/* Mobile-first sticky header */}
      <header className="sticky top-0 z-30 bg-stone-900/95 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="font-display text-lg font-bold">🛵 Driver Portal</p>
            <p className="text-[10px] text-white/40 font-bold">{profile.full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/staff" aria-label="Staff Portal" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition">
              <GraduationCap size={15} />
            </Link>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Online
            </span>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
