import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCategories } from "@/lib/ledger";
import { OpeningBalanceForm, CategoriesManager, ChangePinForm } from "@/components/settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { person } = await requireAuth();
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
        <h2 className="font-bold text-brand-brown">Your PIN, {person.name}</h2>
        <p className="mb-3 text-xs text-stone-500">
          Everyone has their own PIN — it&apos;s how Accounts knows who entered what. Asked after signing in, after 15 minutes
          without use, and when someone taps their name to lock. New people and forgotten PINs: the admin, in the admin panel
          → Staff &amp; Users → Accounts people.
        </p>
        <ChangePinForm />
      </section>
    </div>
  );
}
