// createOrder / createPosOrder store who the order is for as a header in
// orders.notes ("[Guest Checkout]\nName: …\nPhone: …\n\nless spicy please").
// These read it back — shared by the POS panel and the sales-archive Excel.

/** One header field ("Name", "Phone", "Address"), or null if absent / "N/A". */
export function noteField(notes: string | null | undefined, key: string): string | null {
  const m = notes?.match(new RegExp(`${key}:\\s*([^\\n]+)`));
  return m && m[1].trim() !== "N/A" ? m[1].trim() : null;
}

/** What the customer actually typed, without the [..] / Name / Phone / Address header. */
export function customerNote(notes: string | null | undefined): string | null {
  return (notes ?? "").split("\n")
    .filter((l) => !/^\[.*\]$|^(Name|Phone|Address):/.test(l.trim()))
    .join(" ").trim() || null;
}
