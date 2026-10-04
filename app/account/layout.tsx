import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getVerifiedUser } from "@/lib/supabase/server";
import { unreadCount } from "@/lib/notifications";
import SessionGuard from "@/components/session-guard";
import AccountNav from "@/components/account/account-nav";
import BrandLogo from "@/components/brand-logo";

export const dynamic = "force-dynamic";

// One navigation per screen size: tabs in this header on tablets/laptops,
// the bottom bar (components/mobile-nav.tsx) on phones.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getVerifiedUser();
  if (!user || !profile) redirect("/auth/login?redirect=/account");
  const initials = (profile.full_name as string).split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const unread = profile.role === "customer" ? await unreadCount(profile.id, "customers").catch(() => 0) : 0;

  return (
    <div className="min-h-dvh bg-stone-50">
      <SessionGuard userId={profile.id} />
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/account" className="min-w-0"><BrandLogo size="sm" /></Link>
          <AccountNav />
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/account/notifications" aria-label={unread ? `Inbox, ${unread} new` : "Inbox"}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition hover:bg-orange-50 hover:text-brand-orange">
              <Bell size={20} />
              {unread > 0 && <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-extrabold text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <Link href="/order" className="hidden rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white shadow-sm shadow-orange-500/30 transition hover:brightness-110 lg:inline-flex">Order now</Link>
            <Link href="/account/profile" aria-label="Your profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-brown text-xs font-extrabold text-amber-50">{initials}</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5 sm:py-8">{children}</main>
    </div>
  );
}
