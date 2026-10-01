// The sales-archive workbook (Admin → Settings → Sales archives). Built on
// demand from the snapshot stored in sales_archives, so every past reset can
// be downloaded again and the file always matches exactly what was archived.
import "server-only";
import ExcelJS from "exceljs";
import { orderStatusLabel } from "@/lib/order-status";
import { noteField, customerNote } from "@/lib/order-notes";

type ArchivedItem = { product_name: string; product_price: number; quantity: number; line_total: number };
type ArchivedOrder = {
  order_number: string; daily_number: number | null; created_at: string;
  type: string; status: string; payment_method: string | null; payment_status: string;
  subtotal: number; delivery_fee: number; discount_amount: number; discount_label?: string | null; total: number;
  customer_id: string | null; notes: string | null; items?: ArchivedItem[] | null;
};
export type SalesArchive = { id: string; created_at: string; snapshot: ArchivedOrder[] | null };

// Excel has no time zones — shift to Nepal wall-clock time (UTC+5:45, no DST)
// so every date in the file reads as the shop's local time.
const toNepal = (iso: string) => new Date(new Date(iso).getTime() + (5 * 60 + 45) * 60_000);

const RS = '"Rs" #,##0.00';
const DATE_TIME = "dd mmm yyyy  h:mm AM/PM";
const DATE = "dd mmm yyyy";
const ORANGE = "FFE8772E";
const PALE = "FFFDEBD8";

const TYPE: Record<string, string> = { pickup: "Pickup", dine_in: "Dine-in", delivery: "Delivery" };
const METHOD: Record<string, string> = { cash: "Cash", qr: "QR", card: "Card", esewa: "eSewa" };
const PAYMENT: Record<string, string> = { paid: "Paid", pending: "Unpaid", failed: "Failed", refunded: "Refunded" };
// Type-agnostic step names for the summary (the Orders sheet says Collected / Served / Delivered).
const STAGE: Record<string, string> = {
  pending: "Ordered", confirmed: "Confirmed", preparing: "Confirmed", assigned: "Confirmed",
  ready: "Ready", picked_up: "On the way", on_the_way: "On the way", delivered: "Completed", cancelled: "Cancelled",
};
const label = (map: Record<string, string>, v: string | null) => (v ? map[v] ?? v : "—");
const money = (n: unknown) => Math.round(Number(n || 0) * 100) / 100;

export function salesArchiveFilename(createdAt: string) {
  const local = toNepal(createdAt).toISOString(); // UTC fields now hold Nepal time
  return `thelawalaa-sales-${local.slice(0, 10)}-${local.slice(11, 13)}${local.slice(14, 16)}.xlsx`;
}

type Column = { header: string; key: string; width: number; numFmt?: string };

/** A filterable table: frozen, styled header row and a Total row that follows the filter (SUBTOTAL). */
function tableSheet(wb: ExcelJS.Workbook, name: string, columns: Column[], rows: Record<string, unknown>[], totalKeys: string[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.numFmt ? { numFmt: c.numFmt } : {} }));
  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
    cell.alignment = { vertical: "middle" };
  });
  ws.addRows(rows);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  if (rows.length) {
    const last = rows.length + 1;
    const total = ws.addRow({ [columns[0].key]: "Total" });
    for (const key of totalKeys) {
      const letter = ws.getColumn(key).letter;
      const result = rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
      total.getCell(key).value = { formula: `SUBTOTAL(9,${letter}2:${letter}${last})`, result };
    }
    total.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true };
      cell.border = { top: { style: "thin" } };
    });
  }
}

/** A small "label | orders | amount" block on the Summary sheet. */
function breakdown(ws: ExcelJS.Worksheet, title: string, headers: [string, string, string], rows: [unknown, number, number][], firstFmt?: string) {
  ws.addRow([]);
  ws.addRow([title]).font = { bold: true, size: 12 };
  const head = ws.addRow(headers);
  head.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALE } };
  });
  for (const row of rows) {
    const r = ws.addRow(row);
    if (firstFmt) r.getCell(1).numFmt = firstFmt;
    r.getCell(1).alignment = { horizontal: "left" };
    r.getCell(3).numFmt = RS;
  }
}

/** Group orders by a key into [key, order count, sum of amount] rows. */
function tally(orders: ArchivedOrder[], key: (o: ArchivedOrder) => string, amount: (o: ArchivedOrder) => number) {
  const m = new Map<string, [number, number]>();
  for (const o of orders) {
    const [n, sum] = m.get(key(o)) ?? [0, 0];
    m.set(key(o), [n + 1, sum + amount(o)]);
  }
  return [...m.entries()].map(([k, [n, sum]]) => [k, n, money(sum)] as [string, number, number]);
}

export async function buildSalesArchiveWorkbook(archive: SalesArchive): Promise<ArrayBuffer> {
  const orders = [...(archive.snapshot ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const live = orders.filter((o) => o.status !== "cancelled");
  const paidTotal = (o: ArchivedOrder) => (o.payment_status === "paid" ? money(o.total) : 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Thelawalaa";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true; // totals always recalculated when opened

  // ── Summary ──────────────────────────────────────────────────
  const ws = wb.addWorksheet("Summary");
  ws.columns = [{ width: 24 }, { width: 22 }, { width: 18 }];
  ws.addRow(["Thelawalaa — sales archive"]).font = { bold: true, size: 16, color: { argb: ORANGE } };
  ws.addRow(["All times are Nepal time. Paid revenue counts orders marked as paid."]).font = { italic: true, color: { argb: "FF78716C" } };
  ws.addRow([]);
  const facts: [string, unknown, string?][] = [
    ["Archived on", toNepal(archive.created_at), DATE_TIME],
    ["Orders", orders.length],
    ["Paid revenue", money(orders.reduce((s, o) => s + paidTotal(o), 0)), RS],
    ["Unpaid (not cancelled)", live.filter((o) => o.payment_status !== "paid").length],
    ["Cancelled", orders.length - live.length],
    ["First order", orders.length ? toNepal(orders[0].created_at) : "—", DATE_TIME],
    ["Last order", orders.length ? toNepal(orders[orders.length - 1].created_at) : "—", DATE_TIME],
  ];
  for (const [name, value, fmt] of facts) {
    const r = ws.addRow([name, value]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).alignment = { horizontal: "left" };
    if (fmt) r.getCell(2).numFmt = fmt;
  }
  breakdown(ws, "By status", ["Status", "Orders", "Order value"], tally(orders, (o) => label(STAGE, o.status), (o) => money(o.total)));
  breakdown(ws, "By order type", ["Type", "Orders", "Paid revenue"], tally(orders, (o) => label(TYPE, o.type), paidTotal));
  breakdown(ws, "By payment method", ["Payment", "Orders", "Paid revenue"], tally(orders, (o) => label(METHOD, o.payment_method), paidTotal));
  // Days as real Excel dates (Nepal calendar day), oldest first.
  const days = tally(orders, (o) => toNepal(o.created_at).toISOString().slice(0, 10), paidTotal)
    .map(([day, n, sum]) => [new Date(`${day}T00:00:00Z`), n, sum] as [Date, number, number]);
  breakdown(ws, "By day", ["Date", "Orders", "Paid revenue"], days, DATE);

  // ── Orders: one row per order ────────────────────────────────
  tableSheet(wb, "Orders", [
    { header: "Order #", key: "number", width: 20 },
    { header: "No.", key: "daily", width: 6 },
    { header: "Placed", key: "placed", width: 21, numFmt: DATE_TIME },
    { header: "Type", key: "type", width: 10 },
    { header: "Status", key: "status", width: 17 },
    { header: "Customer", key: "customer", width: 22 },
    { header: "Phone", key: "phone", width: 14 },
    { header: "Items", key: "items", width: 48 },
    { header: "Customer note", key: "note", width: 28 },
    { header: "Pay by", key: "method", width: 9 },
    { header: "Payment", key: "payment", width: 10 },
    { header: "Subtotal", key: "subtotal", width: 12, numFmt: RS },
    { header: "Delivery", key: "delivery", width: 11, numFmt: RS },
    { header: "Discount", key: "discount", width: 11, numFmt: RS },
    { header: "Discount for", key: "discountFor", width: 13 },
    { header: "Total", key: "total", width: 12, numFmt: RS },
  ], orders.map((o) => ({
    number: o.order_number,
    daily: o.daily_number ?? "",
    placed: toNepal(o.created_at),
    type: label(TYPE, o.type),
    status: orderStatusLabel(o.status, o.type),
    customer: noteField(o.notes, "Name") ?? (o.customer_id ? "Registered customer" : "Walk-in"),
    phone: noteField(o.notes, "Phone") ?? "",
    items: (o.items ?? []).map((i) => `${i.quantity}× ${i.product_name}`).join(", "),
    note: customerNote(o.notes) ?? "",
    method: label(METHOD, o.payment_method),
    payment: label(PAYMENT, o.payment_status),
    subtotal: money(o.subtotal),
    delivery: money(o.delivery_fee),
    discount: money(o.discount_amount),
    discountFor: o.discount_label ?? "",
    total: money(o.total),
  })), ["subtotal", "delivery", "discount", "total"]);

  // ── Items: one row per line item ─────────────────────────────
  tableSheet(wb, "Items", [
    { header: "Order #", key: "number", width: 20 },
    { header: "Placed", key: "placed", width: 21, numFmt: DATE_TIME },
    { header: "Product", key: "product", width: 30 },
    { header: "Qty", key: "qty", width: 7 },
    { header: "Unit price", key: "price", width: 12, numFmt: RS },
    { header: "Line total", key: "line", width: 12, numFmt: RS },
    { header: "Order status", key: "status", width: 17 },
    { header: "Payment", key: "payment", width: 10 },
  ], orders.flatMap((o) => (o.items ?? []).map((i) => ({
    number: o.order_number,
    placed: toNepal(o.created_at),
    product: i.product_name,
    qty: Number(i.quantity),
    price: money(i.product_price),
    line: money(i.line_total),
    status: orderStatusLabel(o.status, o.type),
    payment: label(PAYMENT, o.payment_status),
  }))), ["qty", "line"]);

  // ── Products: what sold, best first (cancelled orders left out) ──
  const byProduct = new Map<string, { qty: number; value: number }>();
  for (const i of live.flatMap((o) => o.items ?? [])) {
    const p = byProduct.get(i.product_name) ?? { qty: 0, value: 0 };
    byProduct.set(i.product_name, { qty: p.qty + Number(i.quantity), value: money(p.value + Number(i.line_total)) });
  }
  tableSheet(wb, "Products", [
    { header: "Product", key: "product", width: 32 },
    { header: "Qty sold", key: "qty", width: 10 },
    { header: "Sales value", key: "value", width: 16, numFmt: RS },
  ], [...byProduct.entries()]
    .map(([product, p]) => ({ product, qty: p.qty, value: p.value }))
    .sort((a, b) => b.qty - a.qty || b.value - a.value), ["qty", "value"]);

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
