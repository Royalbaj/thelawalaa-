import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/supabase/server";
import { getLowStock } from "@/lib/stock";
import Shell from "@/components/shell";

export const dynamic = "force-dynamic";

// The layout stays put while moving between pages (only the page re-renders),
// so these run once per visit / refresh, not on every tap.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let person: string;
  let lowStock = 0;
  try {
    const [auth, low] = await Promise.all([requireAuth(), getLowStock().catch(() => [])]);
    person = auth.person.name;
    lowStock = low.length;
  } catch (e) {
    redirect(e instanceof Error && e.message === "Locked" ? "/pin" : "/login");
  }
  return <Shell person={person} lowStock={lowStock}>{children}</Shell>;
}
