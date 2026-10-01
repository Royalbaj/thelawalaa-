import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/role-home";
import { POS_THEME_COOKIE } from "@/lib/pos-theme";
import PosHeader from "@/components/admin/pos-header";
import SessionGuard from "@/components/session-guard";
import { PosThemeRoot } from "@/components/pos/pos-theme";

export const dynamic = "force-dynamic";

// "Add to Home Screen" from the POS installs it as its own app that opens
// straight on the till — and on iPad, only an installed web app can get the
// online-order push notifications (components/pos/order-alerts.tsx).
export const metadata: Metadata = {
  manifest: "/pos.webmanifest",
  appleWebApp: { capable: true, title: "Thelawalaa POS", statusBarStyle: "black" },
};
export const viewport: Viewport = { themeColor: "#0c0a09" };

// The POS screen at /admin. Its own route group, NOT app/admin/layout.tsx:
// a layout there wraps every /admin/(mgmt) page too, so gating it to
// pos_user locked super_admin out of the whole management area.
//
// Deliberately minimal — no sidebar here. The POS terminal needs every
// pixel it can get on small screens; the full management shell lives
// only under /admin/(mgmt).
//
// pos_user only — super_admin no longer has the POS terminal in their
// interface at all (not just hidden from the nav). Counter operations
// and business management are deliberately separate logins now.
export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile) redirect("/auth/login?redirect=/admin");
  // Other staff go to their own home, never back through login (a loop).
  if (profile.role !== "pos_user") redirect(ROLE_HOME[profile.role] ?? "/unauthorized");

  // Dark unless this device picked light.
  const dark = (await cookies()).get(POS_THEME_COOKIE)?.value !== "light";

  return (
    <PosThemeRoot initialDark={dark}>
      <SessionGuard userId={profile.id} />
      <PosHeader fullName={profile.full_name} />
      <main className="min-h-0 flex-1">{children}</main>
    </PosThemeRoot>
  );
}
