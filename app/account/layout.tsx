import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getVerifiedUser();
  if (!user || !profile) redirect("/auth/login?redirect=/account");

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* App-like sticky header */}
      <header className="sticky top-0 z-30 bg-brand-dark text-white">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/account" className="font-display text-lg font-bold brand-gradient-text">
            Thelawalaa
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/order" className="rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold hover:brightness-110 transition">
              Order Now
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto">{children}</main>

    </div>
  );
}
