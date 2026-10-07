import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/role-home";
import PosHeader from "@/components/admin/pos-header";
import SessionGuard from "@/components/session-guard";
import { PosThemeRoot } from "@/components/pos/pos-theme";
import PosFooter from "@/components/pos/pos-footer";
import PosSession from "@/components/pos/pos-session";
import PosLockScreen from "@/components/pos/pos-lock-screen";
import { getPosStaff, posLockOn, posLoginKey } from "@/lib/pos-staff";

export const dynamic = "force-dynamic";

// "Add to Home Screen" from the POS installs it as its own app that opens
// straight on the till — and on iPad, only an installed web app can get the
// online-order push notifications (components/pos/order-alerts.tsx).
export const metadata: Metadata = {
  manifest: "/pos.webmanifest",
  appleWebApp: { capable: true, title: "Thelawalaa POS", statusBarStyle: "black" },
};
// viewportFit cover + the safe-area padding in PosThemeRoot: on an iPhone
// with no home button, the installed POS keeps its bottom row clear of the
// home bar (and the notch, sideways) instead of running underneath it.
export const viewport: Viewport = { themeColor: "#0c0a09", viewportFit: "cover" };

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
  const { user, profile } = await getVerifiedUser();
  if (!profile) redirect("/auth/login?redirect=/admin");
  // Other staff go to their own home, never back through login (a loop).
  if (profile.role !== "pos_user") redirect(ROLE_HOME[profile.role] ?? "/unauthorized");

  // Staff login (migration 037): once anyone may clock in on the POS, the till
  // stays locked until a counter person types their PIN (which clocks them in).
  // Until then — nobody set up yet — the POS works as it always did.
  const lockOn = await posLockOn();
  const staff = lockOn && user ? await getPosStaff(posLoginKey(user)) : null;

  // The POS is always dark (owner's call) — easier on the eyes all day at the counter.
  return (
    <PosThemeRoot initialDark>
      <SessionGuard userId={profile.id} />
      <PosSession signedInAt={user?.last_sign_in_at ?? null} />
      {lockOn && !staff ? (
        <PosLockScreen />
      ) : (
        <>
          <PosHeader fullName={profile.full_name} staff={staff} />
          <main className="min-h-0 flex-1">{children}</main>
        </>
      )}
      <PosFooter />
    </PosThemeRoot>
  );
}
