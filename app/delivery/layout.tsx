import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || !["delivery_driver", "admin"].includes(profile.role)) redirect("/auth/login?redirect=/delivery");
  return (
    <div className="min-h-screen bg-brand-cream">
      <header className="border-b border-orange-100 bg-brand-dark px-4 py-3">
        <span className="font-display font-bold brand-gradient-text">Thelawalaa Driver</span>
      </header>
      {children}
    </div>
  );
}
