"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Facebook, Instagram, Link2, Trash2 } from "lucide-react";
import TikTokIcon from "@/components/icons/tiktok";
import { createBranch, setBranchActive, createPromoCode, setPromoActive } from "@/app/actions/admin-crud";
import { updateAppSettings, updateOpeningPromo, addSocialLink, setSocialLinkActive, deleteSocialLink, updateDeliveryArea, updateStaffSale, updateDeliveryHours } from "@/app/actions/settings";
import { deliveryHours, deliverySlots, minutesLabel, slotLabel } from "@/lib/delivery-hours";

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

export function FeatureFlagsForm({ esewaEnabled, deliveryEnabled, posCanCancel }: { esewaEnabled: boolean; deliveryEnabled: boolean; posCanCancel: boolean }) {
  const [esewa, setEsewa] = useState(esewaEnabled);
  const [delivery, setDelivery] = useState(deliveryEnabled);
  const [posCancel, setPosCancel] = useState(posCanCancel);
  const [pending, start] = useTransition();

  function toggle(change: Partial<{ esewa_enabled: boolean; delivery_enabled: boolean; pos_can_cancel: boolean }>) {
    const next = { esewa_enabled: esewa, delivery_enabled: delivery, pos_can_cancel: posCancel, ...change };
    start(async () => {
      const r = await updateAppSettings(next);
      if (r?.error) { toast.error(r.error); return; }
      setEsewa(next.esewa_enabled);
      setDelivery(next.delivery_enabled);
      setPosCancel(next.pos_can_cancel);
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
          onClick={() => toggle({ delivery_enabled: !delivery })}
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
          onClick={() => toggle({ esewa_enabled: !esewa })}
          className={esewa ? "badge bg-green-100 text-green-800" : "badge bg-stone-200 text-stone-600"}
        >
          {esewa ? "Enabled" : "Disabled"}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-sm">Counter (POS) can cancel orders</p>
          <p className="text-xs text-stone-500">When off, the POS has no Cancel button and can&apos;t cancel an order — only you can, from Orders</p>
        </div>
        <button
          disabled={pending}
          onClick={() => toggle({ pos_can_cancel: !posCancel })}
          className={posCancel ? "badge bg-green-100 text-green-800" : "badge bg-stone-200 text-stone-600"}
        >
          {posCancel ? "Allowed" : "Not allowed"}
        </button>
      </div>
    </div>
  );
}

/** Staff sale at the POS: how many items one sale gets free. 0 hides the Staff button. */
export function StaffSaleForm({ freeItems }: { freeItems: number }) {
  const [value, setValue] = useState(String(freeItems));
  const [saved, setSaved] = useState(freeItems);
  const [pending, start] = useTransition();
  const n = value.trim() === "" ? NaN : Number(value);
  const valid = Number.isInteger(n) && n >= 0 && n <= 20;

  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) { toast.error("Enter a number of items from 0 to 20"); return; }
        start(async () => {
          const r = await updateStaffSale({ staff_free_items: n });
          if (r?.error) { toast.error(r.error); return; }
          setSaved(n);
          toast.success(n ? `Staff sale: up to ${n} free item${n > 1 ? "s" : ""}` : "Staff sale switched off");
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display font-bold text-brand-brown">Staff sale</h3>
        <span className={saved ? "badge bg-green-100 text-green-800" : "badge bg-stone-200 text-stone-600"}>
          {saved ? `${saved} free per sale` : "Off"}
        </span>
      </div>
      <p className="text-xs text-stone-500">
        The POS &quot;Staff&quot; button makes items free (price Rs 0) for a staff member, up to this many items in one sale —
        the dearest go free first, anything more is charged as normal. Membership cards are never free. 0 hides the button.
      </p>
      <div>
        <label className="label" htmlFor="staff_free_items">Free items per staff sale</label>
        <input id="staff_free_items" type="number" inputMode="numeric" min={0} max={20} step={1} value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 2))} className="input" />
      </div>
      <button disabled={pending || !valid || n === saved} className="btn-primary w-full">{pending ? "Saving…" : "Save"}</button>
    </form>
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

/** Admin → Settings → Delivery area: the radius, and the shop's exact spot (best set while standing in the shop). */
export function DeliveryAreaForm({ radiusKm, storeLat, storeLng }: { radiusKm: number; storeLat: number | null; storeLng: number | null }) {
  const [radius, setRadius] = useState(String(radiusKm));
  const [lat, setLat] = useState(storeLat != null ? String(storeLat) : "");
  const [lng, setLng] = useState(storeLng != null ? String(storeLng) : "");
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();

  const here = () => {
    if (!("geolocation" in navigator)) { toast.error("This device can't share its location"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6));
        toast.success(`Got it (accurate to about ${Math.round(pos.coords.accuracy)} m) — tap Save`);
      },
      () => { setLocating(false); toast.error("Couldn't get the location — allow it for this site and try again"); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  const save = () => start(async () => {
    const r = await updateDeliveryArea({
      delivery_radius_km: Number(radius),
      store_lat: lat ? Number(lat) : null,
      store_lng: lng ? Number(lng) : null,
    });
    if (r?.error) toast.error(r.error); else toast.success("Delivery area saved");
  });

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h3 className="font-display font-bold text-brand-brown">Delivery area</h3>
        <p className="text-xs text-stone-500">Customers who share a location farther than this can&apos;t order delivery online — they&apos;re asked to call you to confirm. Pickup always works.</p>
      </div>
      <div>
        <label className="label" htmlFor="radius">Deliver within (km)</label>
        <input id="radius" className="input" inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value.replace(/[^\d.]/g, ""))} />
      </div>
      <div>
        <p className="label">Shop location</p>
        <button type="button" onClick={here} disabled={locating}
          className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-brand-orange ring-1 ring-orange-200 hover:bg-orange-50 disabled:opacity-60">
          {locating ? "Finding this device…" : "Use this device's location (stand in the shop)"}
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input className="input" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Latitude" aria-label="Shop latitude" />
          <input className="input" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Longitude" aria-label="Shop longitude" />
        </div>
        <p className="mt-1 text-xs text-stone-500">
          {lat && lng
            ? <a href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-orange">Check it on Google Maps</a>
            : "Not set yet — distances use an approximate Banepa location until you set it."}
        </p>
      </div>
      <button onClick={save} disabled={pending || !radius} className="btn-primary w-full !py-2.5 text-sm">{pending ? "Saving…" : "Save delivery area"}</button>
    </div>
  );
}

/**
 * Delivery hours + booked slots (migration 039). On: website delivery "as soon
 * as possible" only inside the hours; outside, checkout says when delivery
 * starts and the customer books a later slot. Off: delivery any time.
 */
export function DeliveryHoursForm({ initial }: {
  initial: { enabled: boolean; start: string; end: string; slot: number; lead: number; days: number };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [slot, setSlot] = useState(initial.slot);
  const [lead, setLead] = useState(initial.lead);
  const [days, setDays] = useState(initial.days);
  const [pending, startSave] = useTransition();

  // What a customer would see on a day with nothing booked yet (from midnight, so every slot counts).
  const h = deliveryHours({ delivery_hours_enabled: true, delivery_start: start, delivery_end: end, delivery_slot_minutes: slot, delivery_lead_minutes: lead, delivery_days_ahead: 1 });
  const perDay = h.end > h.start ? Math.floor((h.end - h.start) / h.slot) : 0;
  const sampleDay = Date.parse("2000-01-01T00:00:00+05:45");
  const firstSlots = deliverySlots(h, sampleDay).slice(0, 3);
  const save = () => startSave(async () => {
    const r = await updateDeliveryHours({
      delivery_hours_enabled: enabled, delivery_start: start, delivery_end: end,
      delivery_slot_minutes: slot, delivery_lead_minutes: lead, delivery_days_ahead: days,
    });
    if (r?.error) toast.error(r.error); else toast.success("Delivery hours saved");
  });
  const select = "input !py-2 text-base sm:text-sm";

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-brand-brown">Delivery hours</h3>
          <p className="text-xs text-stone-500">
            Website delivery &ldquo;as soon as possible&rdquo; only inside these hours. Outside them, checkout says when you start delivering and
            customers can book a later time slot (they can always book one).
          </p>
        </div>
        <button onClick={() => setEnabled((v) => !v)} aria-pressed={enabled}
          className={enabled ? "badge shrink-0 bg-green-100 text-green-800" : "badge shrink-0 bg-stone-200 text-stone-600"}>
          {enabled ? "On" : "Off — any time"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-bold text-stone-500">Delivery starts
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${select} mt-1`} />
        </label>
        <label className="text-xs font-bold text-stone-500">Delivery ends
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${select} mt-1`} />
        </label>
        <label className="text-xs font-bold text-stone-500">Time slot (timeframe)
          <select value={slot} onChange={(e) => setSlot(Number(e.target.value))} className={`${select} mt-1`}>
            {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-stone-500">Notice before a slot
          <select value={lead} onChange={(e) => setLead(Number(e.target.value))} className={`${select} mt-1`}>
            {[30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}</option>)}
          </select>
        </label>
        <label className="col-span-2 text-xs font-bold text-stone-500">Customers can book
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${select} mt-1`}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d === 1 ? "Today only" : d === 2 ? "Today and tomorrow" : `Up to ${d} days ahead (incl. today)`}</option>)}
          </select>
        </label>
      </div>
      <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-stone-600">
        {perDay > 0
          ? <>{perDay} slots a day ({minutesLabel(h.start)} – {minutesLabel(h.end)}): {firstSlots.map((s) => slotLabel(s, sampleDay).replace(/^Today /, "")).join(", ")}{perDay > 3 ? ", …" : ""} Each slot can be booked until {lead} minutes before it starts.</>
          : "The end time has to be after the start time, with room for at least one slot."}
      </p>
      <button disabled={pending} onClick={save} className="btn-primary w-full !py-2.5 text-sm">{pending ? "Saving…" : "Save delivery hours"}</button>
    </div>
  );
}
