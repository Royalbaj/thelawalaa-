import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import { BranchForm, PromoForm, ActiveToggle, FeatureFlagsForm, OpeningPromoForm, SocialLinksManager, DeliveryAreaForm } from "@/components/admin/settings-controls";
import ResetSalesData from "@/components/admin/reset-sales-data";
import EmailSetupPanel from "@/components/admin/email-setup";

export const dynamic = "force-dynamic";

// The server runs in UTC — show archive times as the shop sees them.
const ARCHIVE_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kathmandu", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
});

export default async function SettingsPage() {
  await requireRole(["super_admin"]);
  const [{ data: branches }, { data: promos }, { data: settings }, { data: socialLinks }, { data: archives }] = await Promise.all([
    supabaseAdmin.from("branches").select("id, name, address, phone, is_active").order("name"),
    supabaseAdmin.from("promo_codes")
      .select("id, code, discount_type, discount_value, min_order_amount, max_uses, uses_count, is_active, expires_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("app_settings").select("*").eq("id", 1).single(),
    supabaseAdmin.from("social_links").select("id, platform, url, is_active").order("sort_order"),
    supabaseAdmin.from("sales_archives")
      .select("id, created_at, order_count, total_revenue, resetter:profiles!sales_archives_reset_by_fkey(full_name)")
      .order("created_at", { ascending: false }),
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
        <section>
          <h2 className="mb-2 font-display font-bold text-brand-brown">Sales archives</h2>
          <div className="card divide-y divide-orange-50">
            {(archives ?? []).map((a) => {
              // Many-to-one embed: an object at runtime, typed as an array by the untyped client.
              const resetBy = (a.resetter as unknown as { full_name: string } | null)?.full_name;
              return (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-bold">{ARCHIVE_DATE.format(new Date(a.created_at))}</p>
                  <p className="text-xs text-stone-500">
                    {a.order_count} orders · {npr(Number(a.total_revenue))} paid{resetBy ? ` · reset by ${resetBy}` : ""}
                  </p>
                </div>
                <a href={`/admin/archives/${a.id}/excel`} className="rounded-full bg-brand-green px-4 py-1.5 text-xs font-bold text-white hover:brightness-110 transition">
                  Download Excel
                </a>
              </div>
              );
            })}
            {(archives ?? []).length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-stone-500">No archives yet — resetting sales data saves one here.</p>
            )}
          </div>
        </section>
      </div>
      <div className="space-y-4">
        <FeatureFlagsForm esewaEnabled={settings?.esewa_enabled ?? false} deliveryEnabled={settings?.delivery_enabled ?? false} />
        <DeliveryAreaForm radiusKm={Number(settings?.delivery_radius_km ?? 5)} storeLat={settings?.store_lat ?? null} storeLng={settings?.store_lng ?? null} />
        <OpeningPromoForm
          enabled={settings?.opening_promo_enabled ?? false}
          momoPrice={Number(settings?.opening_promo_momo_price ?? 11)}
          startsAt={settings?.opening_promo_starts_at ?? null}
          endsAt={settings?.opening_promo_ends_at ?? null}
        />
        <EmailSetupPanel />
        <SocialLinksManager links={(socialLinks ?? []) as never} />
        <BranchForm />
        <PromoForm />
      </div>
    </div>
  );
}
