import { redirect } from "next/navigation";
import Link from "next/link";
import { getVerifiedUser } from "@/lib/supabase/server";
import SessionGuard from "@/components/session-guard";
import AccountNav from "@/components/account/account-nav";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getVerifiedUser();
  if (!user || !profile) redirect("/auth/login?redirect=/account");
  const initials = (profile.full_name as string).split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <div className="min-h-dvh bg-stone-50">
      <SessionGuard userId={profile.id} />
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-display text-xl font-extrabold brand-gradient-text">Thelawalaa</Link>
          <AccountNav />
          <div className="flex items-center gap-2">
            <Link href="/order" className="rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white shadow-sm shadow-orange-500/30 transition hover:brightness-110">Order now</Link>
            <Link href="/account/profile" aria-label="Your profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-brown text-xs font-extrabold text-amber-50">{initials}</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5 sm:py-8">{children}</main>
    </div>
  );
}
