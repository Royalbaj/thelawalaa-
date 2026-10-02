import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/supabase/server";
import Shell from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let fullName: string;
  try {
    ({ profile: { full_name: fullName } } = await requireAuth());
  } catch (e) {
    redirect(e instanceof Error && e.message === "Locked" ? "/pin" : "/login");
  }
  return <Shell fullName={fullName}>{children}</Shell>;
}
