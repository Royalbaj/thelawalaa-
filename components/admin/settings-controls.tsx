"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { createBranch, setBranchActive, createPromoCode, setPromoActive } from "@/app/actions/admin-crud";
import { updateAppSettings } from "@/app/actions/settings";

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
