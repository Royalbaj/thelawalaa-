import { requireAuth } from "@/lib/supabase/server";
import { getLowStock } from "@/lib/stock";
import { posWaiting } from "@/lib/pos";
import Shell from "@/components/shell";
import VersionGuard from "@/components/version-guard";

export const dynamic = "force-dynamic";

// The layout stays put while moving between pages (only the page re-renders),
// so these run once per visit / refresh, not on every tap.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // requireAuth() sends anyone not signed in / not unlocked to /login or /pin itself.
  const [auth, low, pos] = await Promise.all([requireAuth(), getLowStock().catch(() => []), posWaiting().catch(() => 0)]);
  return (
    <>
      {/* Reloads by itself after a deploy, when nobody's typing (an old page's buttons stop working). */}
      <VersionGuard />
      <Shell person={auth.person.name} lowStock={low.length} posWaiting={pos}>{children}</Shell>
    </>
  );
}
