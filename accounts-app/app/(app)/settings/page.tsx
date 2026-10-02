import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCategories } from "@/lib/ledger";
import { OpeningBalanceForm, CategoriesManager, ChangePinForm } from "@/components/settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAuth();
  const [categories, { data: settings }] = await Promise.all([
    getCategories(),
    supabaseAdmin.from("account_settings").select("opening_balance").eq("id", 1).single(),
  ]);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-brand-brown">Settings</h1>

      <section className="card p-5">
        <h2 className="font-bold text-brand-brown">Starting money</h2>
        <p className="mb-3 text-xs text-stone-500">&ldquo;Balance left&rdquo; = this + all money in − all money out.</p>
        <OpeningBalanceForm value={Number(settings?.opening_balance ?? 0)} />
      </section>

      <section className="card p-5">
        <h2 className="font-bold text-brand-brown">Categories</h2>
        <p className="mb-3 text-xs text-stone-500">Hiding a category takes it off the new-entry screen; entries already using it keep it.</p>
        <CategoriesManager categories={categories} />
      </section>

      <section className="card p-5">
        <h2 className="font-bold text-brand-brown">PIN</h2>
        <p className="mb-3 text-xs text-stone-500">Asked after signing in, and again after 15 minutes without use or when someone taps Lock. Same PIN for everyone who uses Accounts.</p>
        <ChangePinForm />
      </section>

      <Link href="/stock" className="card flex items-center gap-3 p-5 transition hover:shadow-md md:hidden">
        <Package size={18} className="text-brand-brown" />
        <span className="flex-1 font-bold text-brand-brown">Stock</span>
        <ChevronRight size={18} className="text-stone-400" />
      </Link>
    </div>
  );
}
