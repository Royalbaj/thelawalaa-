import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { unreadCount } from "@/lib/notifications";
import SessionGuard from "@/components/session-guard";
import BrandLogo from "@/components/brand-logo";
import DriverTabs from "@/components/delivery/driver-tabs";

export const dynamic = "force-dynamic";

// "Add to Home Screen" installs this as its own app (needed on iPhone for
// new-delivery notifications — components/delivery/driver-alerts.tsx).
export const metadata: Metadata = {
  title: "Driver",
  manifest: "/delivery.webmanifest",
  appleWebApp: { capable: true, title: "Thelawalaa Driver", statusBarStyle: "black" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#0c0a09", viewportFit: "cover" };

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || !["delivery_driver", "super_admin"].includes(profile.role)) {
    redirect("/auth/login?redirect=/delivery");
  }
  const unread = await unreadCount(profile.id, "drivers").catch(() => 0);
  const initials = profile.full_name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-dvh bg-stone-950 text-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <SessionGuard userId={profile.id} />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-stone-950/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <BrandLogo size="sm" tone="dark" label="Driver" />
          <span title={profile.full_name} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-extrabold text-orange-100">{initials}</span>
        </div>
      </header>
      {/* Bottom padding: room for the floating tab bar + the iPhone home bar. */}
      <main className="mx-auto max-w-lg px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-4">{children}</main>
      <DriverTabs unread={unread} />
    </div>
  );
}
