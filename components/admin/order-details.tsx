import { ChevronDown, MapPin, Navigation, Phone } from "lucide-react";
import { npr } from "@/lib/utils";
import { noteField, customerNote } from "@/lib/order-notes";
import { directionsUrl, searchUrl } from "@/lib/geo";

export type OrderLine = { product_name: string; quantity: number; product_price: number; line_total: number };
export type DetailOrder = {
  type: string; notes: string | null; subtotal: number; delivery_fee: number; discount_amount: number; discount_label: string | null;
  points_discount: number; total: number; delivery_address: string | null; delivery_lat: number | null; delivery_lng: number | null;
  items: OrderLine[];
};

/** One line of what was ordered, for list rows: "2× Chicken Momo, 1× Coke". */
export function ItemsSummary({ items }: { items: OrderLine[] }) {
  return <p className="text-xs leading-relaxed text-stone-600">{items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ") || "—"}</p>;
}

/** Tap to open: every line with its price, the money breakdown, contact and delivery details. */
export function OrderDetails({ o }: { o: DetailOrder }) {
  const phone = noteField(o.notes, "Phone");
  const address = o.delivery_address ?? noteField(o.notes, "Address");
  const note = customerNote(o.notes);
  const pin = o.delivery_lat != null && o.delivery_lng != null ? { lat: o.delivery_lat, lng: o.delivery_lng } : null;
  return (
    <details className="group mt-2 rounded-xl bg-stone-50 text-sm ring-1 ring-stone-100 open:bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-stone-500 [&::-webkit-details-marker]:hidden">
        Order details <ChevronDown size={14} className="transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-stone-100 px-3 py-3">
        <table className="w-full text-xs">
          <tbody>
            {o.items.map((i, k) => (
              <tr key={k} className="align-top">
                <td className="py-0.5 pr-2 font-bold text-brand-brown">{i.quantity}×</td>
                <td className="w-full py-0.5 text-stone-700">{i.product_name} <span className="text-stone-400">@ {npr(Number(i.product_price))}</span></td>
                <td className="whitespace-nowrap py-0.5 text-right font-bold text-stone-700">{npr(Number(i.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-0.5 border-t border-dashed border-stone-200 pt-2 text-xs">
          <div className="flex justify-between text-stone-500"><dt>Subtotal</dt><dd>{npr(Number(o.subtotal))}</dd></div>
          {Number(o.delivery_fee) > 0 && <div className="flex justify-between text-stone-500"><dt>Delivery</dt><dd>{npr(Number(o.delivery_fee))}</dd></div>}
          {Number(o.discount_amount) > 0 && <div className="flex justify-between text-brand-green"><dt>{o.discount_label ?? "Discount"}</dt><dd>−{npr(Number(o.discount_amount))}</dd></div>}
          {Number(o.points_discount) > 0 && <div className="flex justify-between text-brand-green"><dt>Points</dt><dd>−{npr(Number(o.points_discount))}</dd></div>}
          <div className="flex justify-between pt-1 text-sm font-extrabold text-brand-brown"><dt>Total</dt><dd>{npr(Number(o.total))}</dd></div>
        </dl>
        {(phone || address || note) && (
          <div className="space-y-1.5 border-t border-stone-100 pt-2 text-xs text-stone-600">
            {phone && <a href={`tel:${phone}`} className="flex items-center gap-1.5 font-bold text-brand-orange"><Phone size={13} /> {phone}</a>}
            {o.type === "delivery" && address && <p className="flex gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0 text-stone-400" /> {address}</p>}
            {o.type === "delivery" && (pin || address) && (
              <a href={pin ? directionsUrl(pin) : searchUrl(address ?? "")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-brand-orange">
                <Navigation size={13} /> {pin ? "Customer's pin on the map" : "Find the address on the map"}
              </a>
            )}
            {note && <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-amber-900">“{note}”</p>}
          </div>
        )}
      </div>
    </details>
  );
}
