import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import { BranchForm, PromoForm, ActiveToggle, FeatureFlagsForm } from "@/components/admin/settings-controls";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireRole(["super_admin"]);
  const [{ data: branches }, { data: promos }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("branches").select("id, name, address, phone, is_active").order("name"),
    supabaseAdmin.from("promo_codes")
      .select("id, code, discount_type, discount_value, min_order_amount, max_uses, uses_count, is_active, expires_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("app_settings").select("esewa_enabled, delivery_enabled").eq("id", 1).single(),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section>
          <h2 className="mb-2 font-display font-bold text-slate-900">Branches</h2>
          <div className="card divide-y divide-slate-100">
            {(branches ?? []).map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div><p className="font-bold">{b.name}</p><p className="text-xs text-slate-500">{b.address}</p></div>
                <ActiveToggle id={b.id} active={b.is_active} kind="branch" />
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-display font-bold text-slate-900">Promo codes</h2>
          <div className="card divide-y divide-slate-100">
            {(promos ?? []).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono font-bold">{p.code}</p>
                  <p className="text-xs text-slate-500">
                    {p.discount_type === "percent" ? `${p.discount_value}% off` : `${npr(Number(p.discount_value))} off`}
                    {Number(p.min_order_amount) > 0 && ` · min ${npr(Number(p.min_order_amount))}`}
                    {p.max_uses && ` · ${p.uses_count}/${p.max_uses} used`}
                  </p>
                </div>
                <ActiveToggle id={p.id} active={p.is_active} kind="promo" />
              </div>
            ))}
            {(promos ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">No promo codes yet.</p>}
          </div>
        </section>
      </div>
      <div className="space-y-4">
        <FeatureFlagsForm esewaEnabled={settings?.esewa_enabled ?? false} deliveryEnabled={settings?.delivery_enabled ?? false} />
        <BranchForm />
        <PromoForm />
      </div>
    </div>
  );
}
