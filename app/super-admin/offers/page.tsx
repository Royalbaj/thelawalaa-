import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import OfferControls from "@/components/super-admin/offer-controls";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  await requireRole(["super_admin"]);

  const { data: offers } = await supabaseAdmin
    .from("offers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-brown">Offers & Deals</h1>
        <p className="text-sm text-stone-500 mt-0.5">Create promotional offers visible to all customers in their dashboard</p>
      </div>
      <OfferControls offers={(offers ?? []) as any} />
    </div>
  );
}
