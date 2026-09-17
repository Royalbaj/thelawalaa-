"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Facebook, Instagram, Link2, Trash2 } from "lucide-react";
import TikTokIcon from "@/components/icons/tiktok";
import { createBranch, setBranchActive, createPromoCode, setPromoActive } from "@/app/actions/admin-crud";
import { updateAppSettings, updateOpeningPromo, addSocialLink, setSocialLinkActive, deleteSocialLink } from "@/app/actions/settings";

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p === "facebook") return Facebook;
  if (p === "instagram") return Instagram;
  if (p === "tiktok") return TikTokIcon;
  return Link2;
}

export function BranchForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = Object.fromEntries(new FormData(form));
        start(async () => {
          const r = await createBranch(fd);
          if (r?.error) toast.error(r.error); else { toast.success("Branch added"); form.reset(); }
        });
      }}
    >
      <h3 className="font-display font-bold text-brand-brown">Add branch</h3>
      <input name="name" required placeholder="Branch name" className="input" maxLength={80} />
      <textarea name="address" required placeholder="Address" rows={2} className="input" maxLength={300} />
      <input name="phone" placeholder="Phone" className="input" maxLength={20} />
      <button disabled={pending} className="btn-primary">Add branch</button>
    </form>
  );
}

export function PromoForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = Object.fromEntries(new FormData(form));
        start(async () => {
          const r = await createPromoCode({
            code: String(fd.code).toUpperCase(), discount_type: fd.discount_type,
            discount_value: fd.discount_value, min_order_amount: fd.min_order_amount || 0,
            max_uses: fd.max_uses || undefined, expires_at: fd.expires_at,
          });
          if (r?.error) toast.error(r.error); else { toast.success("Promo created"); form.reset(); }
        });
      }}
    >
      <h3 className="font-display font-bold text-brand-brown">New promo code</h3>
      <input name="code" required placeholder="CHAAT10" className="input uppercase" maxLength={20} />
      <div className="grid grid-cols-2 gap-3">
        <select name="discount_type" className="input"><option value="percent">% off</option><option value="flat">Rs flat</option></select>
        <input name="discount_value" required type="number" min="1" placeholder="Value" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input name="min_order_amount" type="number" min="0" placeholder="Min order Rs" className="input" />
        <input name="max_uses" type="number" min="1" placeholder="Max uses" className="input" />
      </div>
      <label className="label">Expires (optional)<input name="expires_at" type="datetime-local" className="input mt-1" /></label>
      <button disabled={pending} className="btn-primary">Create promo</button>
    </form>
  );
}

export function FeatureFlagsForm({ esewaEnabled, deliveryEnabled }: { esewaEnabled: boolean; deliveryEnabled: boolean }) {
  const [esewa, setEsewa] = useState(esewaEnabled);
  const [delivery, setDelivery] = useState(deliveryEnabled);
  const [pending, start] = useTransition();

  function toggle(next: { esewa_enabled: boolean; delivery_enabled: boolean }) {
    start(async () => {
      const r = await updateAppSettings(next);
      if (r?.error) { toast.error(r.error); return; }
      setEsewa(next.esewa_enabled);
      setDelivery(next.delivery_enabled);
      toast.success("Updated");
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <h3 className="font-display font-bold text-brand-brown">Feature flags</h3>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-sm">Delivery</p>
          <p className="text-xs text-stone-500">Show delivery as an order type at checkout</p>
        </div>
        <button
          disabled={pending}
          onClick={() => toggle({ esewa_enabled: esewa, delivery_enabled: !delivery })}
          className={delivery ? "badge bg-green-100 text-green-800" : "badge bg-stone-200 text-stone-600"}
        >
          {delivery ? "Enabled" : "Disabled"}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-sm">eSewa online payment</p>
          <p className="text-xs text-stone-500">Show eSewa as a payment option at checkout</p>
        </div>
        <button
          disabled={pending}
          onClick={() => toggle({ esewa_enabled: !esewa, delivery_enabled: delivery })}
          className={esewa ? "badge bg-green-100 text-green-800" : "badge bg-stone-200 text-stone-600"}
        >
          {esewa ? "Enabled" : "Disabled"}
        </button>
      </div>
    </div>
  );
}

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OpeningPromoForm({
  enabled, momoPrice, startsAt, endsAt,
}: { enabled: boolean; momoPrice: number; startsAt: string | null; endsAt: string | null }) {
  const [pending, start] = useTransition();

  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.currentTarget));
        start(async () => {
          const r = await updateOpeningPromo({
            opening_promo_enabled: fd.opening_promo_enabled === "on",
            opening_promo_momo_price: fd.opening_promo_momo_price,
            opening_promo_starts_at: fd.opening_promo_starts_at,
            opening_promo_ends_at: fd.opening_promo_ends_at,
          });
          r?.error ? toast.error(r.error) : toast.success("Opening promo updated");
        });
      }}
    >
      <h3 className="font-display font-bold text-brand-brown">Opening-day promo</h3>
      <p className="text-xs text-stone-500">Momo at a special price for everyone, automatically, only within this window — no signup or code needed.</p>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="opening_promo_enabled" defaultChecked={enabled} /> Enabled
      </label>
      <div>
        <label className="label" htmlFor="opening_promo_momo_price">Momo price (Rs)</label>
        <input id="opening_promo_momo_price" name="opening_promo_momo_price" type="number" min="1" step="1" defaultValue={momoPrice} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="opening_promo_starts_at">Starts</label>
          <input id="opening_promo_starts_at" name="opening_promo_starts_at" type="datetime-local" defaultValue={toLocalInputValue(startsAt)} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="opening_promo_ends_at">Ends</label>
          <input id="opening_promo_ends_at" name="opening_promo_ends_at" type="datetime-local" defaultValue={toLocalInputValue(endsAt)} className="input" />
        </div>
      </div>
      <button disabled={pending} className="btn-primary w-full">{pending ? "Saving…" : "Save promo"}</button>
    </form>
  );
}

export function SocialLinksManager({ links }: { links: { id: string; platform: string; url: string; is_active: boolean }[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="card space-y-4 p-5">
      <h3 className="font-display font-bold text-brand-brown">Social media links</h3>
      <div className="space-y-2">
        {links.map((l) => {
          const Icon = platformIcon(l.platform);
          return (
            <div key={l.id} className="flex items-center gap-2 rounded-xl bg-stone-50 p-2.5">
              <Icon size={16} className="shrink-0 text-brand-brown" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold capitalize">{l.platform}</p>
                <p className="truncate text-[11px] text-stone-500">{l.url}</p>
              </div>
              <button
                disabled={pending}
                onClick={() => start(async () => {
                  const r = await setSocialLinkActive(l.id, !l.is_active);
                  r?.error ? toast.error(r.error) : toast.success("Updated");
                })}
                className={l.is_active ? "badge bg-green-100 text-green-800 shrink-0" : "badge bg-stone-200 text-stone-600 shrink-0"}
              >
                {l.is_active ? "On" : "Off"}
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Remove ${l.platform} link?`)) return;
                  start(async () => {
                    const r = await deleteSocialLink(l.id);
                    r?.error ? toast.error(r.error) : toast.success("Removed");
                  });
                }}
                className="shrink-0 text-stone-400 hover:text-brand-red transition"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
        {links.length === 0 && <p className="text-sm text-stone-400">No social links yet.</p>}
      </div>
      <form
        className="space-y-2 border-t border-stone-100 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = Object.fromEntries(new FormData(form));
          start(async () => {
            const r = await addSocialLink({ platform: fd.platform, url: fd.url });
            if (r?.error) toast.error(r.error);
            else { toast.success("Link added"); form.reset(); }
          });
        }}
      >
        <input name="platform" required placeholder="Platform (e.g. facebook, instagram, tiktok, youtube)" className="input" maxLength={30} />
        <input name="url" required type="url" placeholder="https://..." className="input" maxLength={300} />
        <button disabled={pending} className="btn-primary w-full">{pending ? "Adding…" : "Add link"}</button>
      </form>
    </div>
  );
}

export function ActiveToggle({ id, active, kind }: { id: string; active: boolean; kind: "branch" | "promo" }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => {
        const r = kind === "branch" ? await setBranchActive(id, !active) : await setPromoActive(id, !active);
        r?.error ? toast.error(r.error) : toast.success("Updated");
      })}
      className={active ? "badge bg-green-100 text-green-800" : "badge bg-stone-200 text-stone-600"}
    >
      {active ? "Active" : "Inactive"}
    </button>
  );
}
