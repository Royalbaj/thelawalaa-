import "server-only";
import ExcelJS from "exceljs";
import { prettyDate, longDate, eachDay, nepalToday, type Ymd } from "@/lib/dates";
import { nepalDay, nepalTime, channelOf, TYPE_LABELS, METHOD_LABELS, type ReportOrder, type SalesReport } from "@/lib/sales-report";
import { orderStatusLabel } from "@/lib/order-status";
import { fmtMinutes } from "@/lib/serving-time";

// Admin → Reports → Download Excel: the same period as on screen, laid out to
// be read and printed. Daily sales are the point: their own sheet (best day in
// green, today in yellow, Saturdays shaded, a bar per day, totals), a "best
// day" line on the summary, and the order list broken into days with each
// day's total on a highlighted bar.

const COLOR = {
  brown: "FF78350F", orange: "FFF97316", cream: "FFFFFBEB", band: "FFFFEDD5", green: "FFDCFCE7", greenText: "FF166534",
  yellow: "FFFEF3C7", sat: "FFFAF5EF", grey: "FF9CA3AF", line: "FFE7E5E4", red: "FFB91C1C", amber: "FFB45309", white: "FFFFFFFF",
};
const MONEY = '"Rs "#,##0';
const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin" as const, color: { argb: COLOR.line } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (d: Ymd) => WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()];
const asDate = (d: Ymd) => new Date(`${d}T00:00:00Z`);

/** A big title bar across `cols` columns, then a grey line under it. */
function title(ws: ExcelJS.Worksheet, cols: number, text: string, sub: string) {
  ws.mergeCells(1, 1, 1, cols);
  const t = ws.getCell(1, 1);
  t.value = text;
  t.font = { bold: true, size: 16, color: { argb: COLOR.white } };
  t.fill = fill(COLOR.brown);
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 32;
  ws.mergeCells(2, 1, 2, cols);
  const s = ws.getCell(2, 1);
  s.value = sub;
  s.font = { italic: true, size: 10, color: { argb: "FF57534E" } };
  s.alignment = { indent: 1 };
  ws.getRow(2).height = 18;
}
/** A table header row: white bold text on orange, centred, bordered. */
function headerRow(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: COLOR.white } };
    c.fill = fill(COLOR.orange);
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = box;
  });
  row.height = 22;
}
function borderRow(row: ExcelJS.Row, from: number, to: number) {
  for (let c = from; c <= to; c++) row.getCell(c).border = box;
}

type Day = { day: Ymd; orders: number; counter: number; online: number; total: number; discounts: number; cancelled: number };
function dailyRows(orders: ReportOrder[], from: Ymd, to: Ymd): Day[] {
  const days = new Map<Ymd, Day>(eachDay(from, to).map((d) => [d, { day: d, orders: 0, counter: 0, online: 0, total: 0, discounts: 0, cancelled: 0 }]));
  for (const o of orders) {
    const d = days.get(nepalDay(o.created_at));
    if (!d) continue;
    if (o.status === "cancelled") { d.cancelled += 1; continue; }
    d.discounts += o.discount_amount;
    if (o.payment_status !== "paid") continue;
    d.orders += 1;
    d.total += o.total;
    if (o.placed_by) d.counter += o.total; else d.online += o.total;
  }
  return [...days.values()];
}

/** The Admin → Reports workbook for a period (already loaded with getSalesReport). */
export function buildSalesWorkbook(r: SalesReport, range: { from: Ymd; to: Ymd }, today: Ymd = nepalToday()) {
  const k = r.kpis;
  const period = `${prettyDate(range.from)} – ${prettyDate(range.to)} · Nepal time`;
  const generated = `Downloaded ${prettyDate(today)}`;

  const days = dailyRows(r.orders, range.from, range.to);
  const salesDays = days.filter((d) => d.total > 0);
  const best = salesDays.reduce<Day | null>((b, d) => (!b || d.total > b.total ? d : b), null);
  const dailyAvg = salesDays.length ? k.sales / salesDays.length : 0;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Thelawalaa";
  wb.created = new Date();

  // ── Summary ────────────────────────────────────────────────────────────────
  const sum = wb.addWorksheet("Summary", { properties: { tabColor: { argb: COLOR.brown } }, views: [{ showGridLines: false }] });
  sum.columns = [{ width: 34 }, { width: 20 }, { width: 14 }, { width: 12 }];
  title(sum, 4, "Thelawalaa — Sales report", `${period} · ${generated}`);

  const kpi = (label: string, value: number | string, money = false, highlight?: string) => {
    const row = sum.addRow([label, value]);
    row.getCell(1).font = { color: { argb: "FF57534E" } };
    row.getCell(2).font = { bold: true, size: 13 };
    if (money) row.getCell(2).numFmt = MONEY;
    row.getCell(2).alignment = { horizontal: "right" };
    if (highlight) { row.getCell(1).fill = fill(highlight); row.getCell(2).fill = fill(highlight); }
    borderRow(row, 1, 2);
    row.height = 20;
    return row;
  };
  sum.addRow([]);
  kpi("Sales (paid, not cancelled)", k.sales, true, COLOR.green).getCell(2).font = { bold: true, size: 15, color: { argb: COLOR.greenText } };
  kpi("Paid orders", k.paidOrders);
  kpi("Average paid order", Math.round(k.avgOrder), true);
  kpi("Average sales per selling day", Math.round(dailyAvg), true);
  if (best) {
    const row = kpi("Best day", `${longDate(best.day)} — Rs ${Math.round(best.total).toLocaleString("en-IN")}`, false, COLOR.yellow);
    row.getCell(2).font = { bold: true, size: 12 };
  }
  kpi("Items sold", k.itemsSold);
  kpi("Discounts given", k.discounts, true);
  kpi("To collect (unpaid)", k.toCollect, true, k.toCollect > 0 ? COLOR.band : undefined);
  kpi("Cancelled orders", k.cancelled);
  kpi("Average serving time (placed → served)", fmtMinutes(k.serving.avgServe));
  kpi("Average time to ready (placed → ready)", fmtMinutes(k.serving.avgReady));

  const block = (heading: string, rows: { name: string; amount: number; count?: number; share?: number }[], countLabel: string) => {
    sum.addRow([]);
    headerRow(sum.addRow([heading, "Sales", countLabel, "Share"]));
    rows.forEach((s, i) => {
      const row = sum.addRow([s.name, s.amount, s.count ?? "", s.share ?? null]);
      row.getCell(2).numFmt = MONEY;
      row.getCell(4).numFmt = "0%";
      if (i % 2) for (let c = 1; c <= 4; c++) row.getCell(c).fill = fill(COLOR.cream);
      borderRow(row, 1, 4);
    });
    const total = sum.addRow(["Total", rows.reduce((s, x) => s + x.amount, 0), rows.reduce((s, x) => s + (x.count ?? 0), 0) || ""]);
    total.font = { bold: true };
    total.getCell(2).numFmt = MONEY;
    for (let c = 1; c <= 4; c++) total.getCell(c).border = { ...box, top: { style: "medium", color: { argb: COLOR.brown } } };
  };
  block("By channel", r.byChannel, "Orders");
  block("By payment method", r.byMethod, "Orders");
  block("By order type", r.byType, "Orders");
  block("By category (before discounts)", r.byCategory, "Items");
  sum.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // ── Daily sales ────────────────────────────────────────────────────────────
  const ds = wb.addWorksheet("Daily sales", { properties: { tabColor: { argb: COLOR.orange } }, views: [{ state: "frozen", ySplit: 3, showGridLines: false }] });
  ds.columns = [{ width: 14 }, { width: 7 }, { width: 12 }, { width: 15 }, { width: 13 }, { width: 15 }, { width: 13 }, { width: 11 }, { width: 13 }];
  title(ds, 9, "Daily sales", `${period} · green = best day · yellow = today · shaded = Saturday`);
  headerRow(ds.addRow(["Date", "Day", "Paid orders", "Counter (POS)", "Online", "Total sales", "Discounts", "Cancelled", "Avg order"]));
  const first = ds.rowCount + 1;
  for (const d of days) {
    const row = ds.addRow([asDate(d.day), weekday(d.day), d.orders, d.counter, d.online, d.total, d.discounts, d.cancelled, d.orders ? Math.round(d.total / d.orders) : null]);
    row.getCell(1).numFmt = "dd mmm yyyy";
    [4, 5, 6, 7, 9].forEach((c) => { row.getCell(c).numFmt = MONEY; });
    row.getCell(6).font = { bold: true };
    const tint = best && d.day === best.day ? COLOR.green : d.day === today ? COLOR.yellow : weekday(d.day) === "Sat" ? COLOR.sat : null;
    if (tint) for (let c = 1; c <= 9; c++) row.getCell(c).fill = fill(tint);
    if (best && d.day === best.day) row.font = { bold: true, color: { argb: COLOR.greenText } };
    else if (d.total === 0) row.font = { color: { argb: COLOR.grey } };
    borderRow(row, 1, 9);
  }
  const last = ds.rowCount;
  if (last >= first) {
    // A bar inside each day's total, so the strong days jump out.
    ds.addConditionalFormatting({
      ref: `F${first}:F${last}`,
      rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: COLOR.orange }, gradient: true } as ExcelJS.DataBarRuleType],
    });
    const tot = ds.addRow(["Total", "", { formula: `SUM(C${first}:C${last})`, result: k.paidOrders }, { formula: `SUM(D${first}:D${last})`, result: days.reduce((s, d) => s + d.counter, 0) },
      { formula: `SUM(E${first}:E${last})`, result: days.reduce((s, d) => s + d.online, 0) }, { formula: `SUM(F${first}:F${last})`, result: k.sales },
      { formula: `SUM(G${first}:G${last})`, result: days.reduce((s, d) => s + d.discounts, 0) }, { formula: `SUM(H${first}:H${last})`, result: k.cancelled }, ""]);
    tot.font = { bold: true, size: 12 };
    [4, 5, 6, 7].forEach((c) => { tot.getCell(c).numFmt = MONEY; });
    for (let c = 1; c <= 9; c++) { tot.getCell(c).fill = fill(COLOR.band); tot.getCell(c).border = { ...box, top: { style: "medium", color: { argb: COLOR.brown } } }; }
    const avg = ds.addRow(["Average per selling day", "", "", "", "", Math.round(dailyAvg)]);
    avg.font = { italic: true };
    avg.getCell(6).numFmt = MONEY;
  }
  ds.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "3:3" };

  // ── Orders, by day ─────────────────────────────────────────────────────────
  const os = wb.addWorksheet("Orders", { views: [{ state: "frozen", ySplit: 3 }] });
  os.columns = [
    { key: "time", width: 8 }, { key: "no", width: 6 }, { key: "num", width: 17 }, { key: "ch", width: 14 }, { key: "type", width: 10 },
    { key: "status", width: 16 }, { key: "method", width: 9 }, { key: "pay", width: 9 }, { key: "sub", width: 11 }, { key: "disc", width: 10 },
    { key: "dl", width: 14 }, { key: "del", width: 9 }, { key: "total", width: 11 }, { key: "served", width: 11 },
  ];
  title(os, 14, "Orders by day", `${period} · each day starts with its total · grey = cancelled · amber = not paid yet`);
  headerRow(os.addRow(["Time", "#", "Order number", "Channel", "Type", "Status", "Paid by", "Payment", "Subtotal", "Discount", "Discount type", "Delivery", "Total", "Served in (min)"]));
  const byDay = new Map<Ymd, ReportOrder[]>();
  for (const o of r.orders) { const d = nepalDay(o.created_at); byDay.set(d, [...(byDay.get(d) ?? []), o]); }
  for (const d of days) {
    const list = byDay.get(d.day);
    if (!list?.length) continue;
    // The day's bar: the date and that day's paid sales, highlighted.
    const bar = os.addRow([`${longDate(d.day)}   ·   ${d.orders} paid order${d.orders === 1 ? "" : "s"}${d.cancelled ? `, ${d.cancelled} cancelled` : ""}`]);
    os.mergeCells(bar.number, 1, bar.number, 12);
    bar.getCell(13).value = d.total;
    bar.getCell(13).numFmt = MONEY;
    const isBest = best && d.day === best.day;
    for (let c = 1; c <= 14; c++) bar.getCell(c).fill = fill(isBest ? COLOR.green : COLOR.band);
    bar.font = { bold: true, size: 12, color: { argb: isBest ? COLOR.greenText : COLOR.brown } };
    bar.height = 22;
    bar.getCell(1).alignment = { vertical: "middle", indent: 1 };
    for (const o of list) {
      const cancelled = o.status === "cancelled", unpaid = o.payment_status !== "paid";
      const row = os.addRow({
        time: nepalTime(o.created_at), no: o.daily_number ?? "", num: o.order_number, ch: channelOf(o), type: TYPE_LABELS[o.type] ?? o.type,
        status: cancelled ? "Cancelled" : orderStatusLabel(o.status, o.type), method: METHOD_LABELS[o.payment_method ?? ""] ?? o.payment_method ?? "",
        pay: unpaid ? "Unpaid" : "Paid", sub: o.subtotal, disc: o.discount_amount || null, dl: o.discount_label ?? "",
        del: o.delivery_fee || null, total: o.total,
        served: o.served_at ? Math.round((new Date(o.served_at).getTime() - new Date(o.created_at).getTime()) / 6000) / 10 : null,
      });
      ["sub", "disc", "del", "total"].forEach((c) => { row.getCell(c).numFmt = MONEY; });
      if (cancelled) row.font = { color: { argb: COLOR.grey }, strike: true };
      else if (unpaid) row.getCell("pay").font = { bold: true, color: { argb: COLOR.amber } };
      borderRow(row, 1, 14);
    }
  }
  os.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "3:3" };

  // ── Products ───────────────────────────────────────────────────────────────
  const ps = wb.addWorksheet("Products", { views: [{ state: "frozen", ySplit: 3, showGridLines: false }] });
  ps.columns = [{ width: 6 }, { width: 34 }, { width: 10 }, { width: 22 }, { width: 10 }];
  title(ps, 5, "Products sold", period);
  headerRow(ps.addRow(["Rank", "Product", "Sold", "Sales (before discounts)", "Share"]));
  const productTotal = r.topProducts.reduce((s, p) => s + p.amount, 0);
  r.topProducts.forEach((p, i) => {
    const row = ps.addRow([i + 1, p.name, p.count, p.amount, productTotal ? p.amount / productTotal : null]);
    row.getCell(4).numFmt = MONEY;
    row.getCell(5).numFmt = "0%";
    if (i < 3) { for (let c = 1; c <= 5; c++) row.getCell(c).fill = fill(COLOR.band); row.font = { bold: true }; }
    borderRow(row, 1, 5);
  });

  // ── By month (long periods) ────────────────────────────────────────────────
  if (r.unit === "month") {
    const ms = wb.addWorksheet("By month", { views: [{ state: "frozen", ySplit: 3, showGridLines: false }] });
    ms.columns = [{ width: 12 }, { width: 12 }, { width: 15 }, { width: 13 }, { width: 15 }];
    title(ms, 5, "Sales by month", period);
    headerRow(ms.addRow(["Month", "Paid orders", "Counter (POS)", "Online", "Total"]));
    r.periods.forEach((p) => {
      const row = ms.addRow([p.label, p.orders, p.counter, p.online, p.counter + p.online]);
      [3, 4, 5].forEach((c) => { row.getCell(c).numFmt = MONEY; });
      row.getCell(5).font = { bold: true };
      borderRow(row, 1, 5);
    });
  }

  return wb;
}
