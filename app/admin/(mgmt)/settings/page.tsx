import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import { BranchForm, PromoForm, ActiveToggle, FeatureFlagsForm, OpeningPromoForm, SocialLinksManager } from "@/components/admin/settings-controls";
import ResetSalesData from "@/components/admin/reset-sales-data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireRole(["admin"]);
  const [{ data: branches }, { data: promos }, { data: settings }, { data: socialLinks }] = await Promise.all([
    supabaseAdmin.from("branches").select("id, name, address, phone, is_active").order("name"),
    supabaseAdmin.from("promo_codes")
      .select("id, code, discount_type, discount_value, min_order_amount, max_uses, uses_count, is_active, expires_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("app_settings").select("*").eq("id", 1).single(),
    supabaseAdmin.from("social_links").select("id, platform, url, is_active").order("sort_order"),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section>
          <h2 className="mb-2 font-display font-bold text-brand-brown">Branches</h2>
          <div className="card divide-y divide-orange-50">
            {(branches ?? []).map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div><p className="font-bold">{b.name}</p><p className="text-xs text-stone-500">{b.address}</p></div>
                <ActiveToggle id={b.id} active={b.is_active} kind="branch" />
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-display font-bold text-brand-brown">Promo codes</h2>
          <div className="card divide-y divide-orange-50">
            {(promos ?? []).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono font-bold">{p.code}</p>
                  <p className="text-xs text-stone-500">
                    {p.discount_type === "percent" ? `${p.discount_value}% off` : `${npr(Number(p.discount_value))} off`}
                    {Number(p.min_order_amount) > 0 && ` · min ${npr(Number(p.min_order_amount))}`}
                    {p.max_uses && ` · ${p.uses_count}/${p.max_uses} used`}
                  </p>
                </div>
                <ActiveToggle id={p.id} active={p.is_active} kind="promo" />
              </div>
            ))}
            {(promos ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-500">No promo codes yet.</p>}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-display font-bold text-brand-brown">Before opening day</h2>
          <ResetSalesData />
        </section>
      </div>
      <div className="space-y-4">
        <FeatureFlagsForm esewaEnabled={settings?.esewa_enabled ?? false} deliveryEnabled={settings?.delivery_enabled ?? false} />
        <OpeningPromoForm
          enabled={settings?.opening_promo_enabled ?? false}
          momoPrice={Number(settings?.opening_promo_momo_price ?? 11)}
          startsAt={settings?.opening_promo_starts_at ?? null}
          endsAt={settings?.opening_promo_ends_at ?? null}
        />
        <SocialLinksManager links={(socialLinks ?? []) as never} />
        <BranchForm />
        <PromoForm />
      </div>
    </div>
  );
}
