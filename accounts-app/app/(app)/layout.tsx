import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/supabase/server";
import Shell from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const { profile } = await requireAuth();
    return <Shell fullName={profile.full_name}>{children}</Shell>;
  } catch {
    redirect("/login");
  }
}
