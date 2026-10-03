import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Package, Gift, MessageCircle, UtensilsCrossed, Heart, PartyPopper } from "lucide-react";
import { getVerifiedUser, createClient } from "@/lib/supabase/server";
import { getCustomerRewards, greeting } from "@/lib/customer";
import { npr } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/order-status";
import RewardsCard from "@/components/account/rewards-card";
import OrderTracker from "@/components/account/order-tracker";
import ReorderButton from "@/components/account/reorder-button";
import { OffersJoinCard } from "@/components/account/offers-join";

export const dynamic = "force-dynamic";

const nepalDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short" });

export default async function AccountHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { user, profile } = await getVerifiedUser();
  if (!user || !profile) return null;
  const welcome = (await searchParams).welcome === "1";

  const supabase = await createClient();
  const [rewards, { data: offers }, { data: orders }, { data: favorites }, { data: consent }] = await Promise.all([
    getCustomerRewards(user.id),
    supabase.from("offers").select("*").order("sort_order").limit(6),
    supabase.from("orders").select("id, order_number, daily_number, status, total, type, payment_status, created_at, items:order_items(product_name, quantity)")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("customer_favorites").select("product_id, products(name, price, image_url)").eq("customer_id", user.id).limit(4),
    supabase.from("profiles").select("marketing_opt_in").eq("id", user.id).single(),
  ]);
  const active = (orders ?? []).find((o) => !["delivered", "cancelled"].includes(o.status));
  const first = profile.full_name.split(" ")[0];

  return (
    <div className="space-y-6 pb-4">
      {welcome && (
        <div className="flex items-start gap-3 rounded-3xl bg-green-50 p-5 ring-1 ring-green-200">
          <PartyPopper className="mt-0.5 shrink-0 text-brand-green" size={24} />
          <div>
            <p className="font-display text-lg font-bold text-green-900">Welcome to Thelawalaa, {first}!</p>
            <p className="text-sm text-green-800">Your email is confirmed and your account is ready. We&apos;ve sent you a welcome email with how your rewards work.</p>
          </div>
        </div>
      )}

      <div>
        <h1 className="font-display text-2xl font-extrabold text-brand-brown sm:text-3xl">{greeting()}, {first} 👋</h1>
        <p className="text-stone-500">What are you craving today?</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {active && <OrderTracker order={active} />}

          {profile.role === "customer" && <OffersJoinCard joined={!!consent?.marketing_opt_in} />}

          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { href: "/order", icon: ShoppingBag, label: "Order", tint: "bg-orange-50 text-brand-orange" },
              { href: "/account/orders", icon: Package, label: "My orders", tint: "bg-blue-50 text-blue-600" },
              { href: "/account/rewards", icon: Gift, label: "Rewards", tint: "bg-amber-50 text-amber-600" },
              { href: "/whatsapp", icon: MessageCircle, label: "Help", tint: "bg-green-50 text-brand-green" },
            ].map((a) => (
              <Link key={a.label} href={a.href} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-stone-100 transition hover:shadow-md">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.tint}`}><a.icon size={20} /></span>
                <span className="text-xs font-bold text-stone-700">{a.label}</span>
              </Link>
            ))}
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-brand-brown">Recent orders</h2>
              <Link href="/account/orders" className="text-sm font-bold text-brand-orange">See all →</Link>
            </div>
            {(orders ?? []).length === 0 ? (
              <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-100">
                <UtensilsCrossed size={30} className="mx-auto mb-2 text-stone-300" />
                <p className="font-bold text-stone-600">No orders yet</p>
                <p className="mt-1 text-sm text-stone-500">Your first order earns points straight away.</p>
                <Link href="/order" className="btn-primary mt-4 !py-2.5 text-sm">Start ordering</Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {(orders ?? []).slice(0, 3).map((o) => (
                  <div key={o.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/track/${o.id}`} className="min-w-0">
                        <p className="font-bold text-brand-brown">{o.order_number}</p>
                        <p className="truncate text-xs text-stone-500">
                          {nepalDate(o.created_at)} · {(o.items as { product_name: string; quantity: number }[]).map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}
                        </p>
                      </Link>
                      {/* The price only while the order is open — history shows what, not how much. */}
                      {!["delivered", "cancelled"].includes(o.status) && (
                        <p className="shrink-0 text-right font-bold text-brand-brown">
                          {o.payment_status !== "paid" && <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-600">To pay</span>}
                          {npr(Number(o.total))}
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">{orderStatusLabel(o.status, o.type)}</span>
                      <ReorderButton orderId={o.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <RewardsCard r={rewards} compact />
          {(favorites ?? []).length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 font-display text-lg font-bold text-brand-brown"><Heart size={16} className="text-brand-red" fill="currentColor" /> Your favourites</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {(favorites ?? []).map((f) => {
                  const p = f.products as unknown as { name: string; price: number; image_url: string | null } | null;
                  return (
                    <Link key={f.product_id} href="/order" className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
                      <div className="relative h-20 bg-stone-100">{p?.image_url && <Image src={p.image_url} alt="" fill sizes="160px" className="object-cover" />}</div>
                      <div className="p-2.5"><p className="truncate text-xs font-bold text-brand-brown">{p?.name}</p><p className="text-xs font-bold text-brand-orange">{npr(Number(p?.price ?? 0))}</p></div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      </div>

      {(offers ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-brand-brown">Deals for you</h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(offers ?? []).map((offer) => (
              <div key={offer.id} className="w-64 shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
                {offer.image_url ? (
                  <div className="relative h-28"><Image src={offer.image_url} alt={offer.title} fill sizes="256px" className="object-cover" /></div>
                ) : (
                  <div className="flex h-28 items-center justify-center bg-gradient-to-br from-brand-orange to-amber-500"><Gift size={32} className="text-white/80" /></div>
                )}
                <div className="p-3">
                  <p className="text-sm font-bold text-brand-brown">{offer.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{offer.description}</p>
                  {offer.discount_label && <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">{offer.discount_label}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
