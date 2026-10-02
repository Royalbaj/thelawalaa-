import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/supabase/server";
import { resolveRange, prettyDate } from "@/lib/dates";
import { getSalesReport, nepalDay, nepalTime, channelOf, TYPE_LABELS, METHOD_LABELS } from "@/lib/sales-report";
import { orderStatusLabel } from "@/lib/order-status";

// Admin → Reports → Download Excel: the same period as on screen.
export async function GET(request: Request) {
  const { profile } = await getVerifiedUser();
  if (profile?.role !== "super_admin") return new NextResponse("Not allowed", { status: 403 });
  const range = resolveRange(Object.fromEntries(new URL(request.url).searchParams), "month");
  const r = await getSalesReport(range.from, range.to);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Thelawalaa";
  wb.created = new Date();
  const money = '"Rs "#,##0';
  const header = (ws: ExcelJS.Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF78350F" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ width: 30 }, { width: 18 }, { width: 12 }];
  const k = r.kpis;
  sum.addRows([
    ["Thelawalaa — sales report"],
    ["Period", `${prettyDate(range.from)} – ${prettyDate(range.to)} (Nepal time)`],
    [],
    ["Sales (paid, not cancelled)", k.sales],
    ["Orders (not cancelled)", k.orders],
    ["Paid orders", k.paidOrders],
    ["Average paid order", Math.round(k.avgOrder)],
    ["Items sold", k.itemsSold],
    ["Discounts given", k.discounts],
    ["To collect (unpaid)", k.toCollect],
    ["Cancelled orders", k.cancelled],
  ]);
  sum.getRow(1).font = { bold: true, size: 14 };
  [4, 7, 9, 10].forEach((n) => { sum.getRow(n).getCell(2).numFmt = money; });
  const block = (title: string, rows: { name: string; amount: number; count?: number }[], countLabel: string) => {
    sum.addRow([]);
    const h = sum.addRow([title, "Sales", countLabel]);
    h.font = { bold: true };
    rows.forEach((s) => { const row = sum.addRow([s.name, s.amount, s.count ?? ""]); row.getCell(2).numFmt = money; });
  };
  block("By channel", r.byChannel, "Orders");
  block("By payment method", r.byMethod, "Orders");
  block("By order type", r.byType, "Orders");
  block("By category (before discounts)", r.byCategory, "Items");

  const os = wb.addWorksheet("Orders");
  os.columns = [
    { header: "Date", key: "date", width: 12 }, { header: "Time", key: "time", width: 7 }, { header: "#", key: "no", width: 5 },
    { header: "Order number", key: "num", width: 16 }, { header: "Channel", key: "ch", width: 14 }, { header: "Type", key: "type", width: 10 },
    { header: "Status", key: "status", width: 16 }, { header: "Paid by", key: "method", width: 9 }, { header: "Payment", key: "pay", width: 9 },
    { header: "Subtotal", key: "sub", width: 11, style: { numFmt: money } }, { header: "Discount", key: "disc", width: 10, style: { numFmt: money } },
    { header: "Discount type", key: "dl", width: 14 }, { header: "Delivery", key: "del", width: 9, style: { numFmt: money } },
    { header: "Total", key: "total", width: 11, style: { numFmt: money } },
  ];
  r.orders.forEach((o) => os.addRow({
    date: new Date(`${nepalDay(o.created_at)}T00:00:00Z`), time: nepalTime(o.created_at), no: o.daily_number ?? "",
    num: o.order_number, ch: channelOf(o), type: TYPE_LABELS[o.type] ?? o.type,
    status: o.status === "cancelled" ? "Cancelled" : orderStatusLabel(o.status, o.type), method: METHOD_LABELS[o.payment_method ?? ""] ?? o.payment_method ?? "",
    pay: o.payment_status === "paid" ? "Paid" : "Unpaid", sub: o.subtotal, disc: o.discount_amount || null, dl: o.discount_label ?? "",
    del: o.delivery_fee || null, total: o.total,
  }));
  os.getColumn("date").numFmt = "dd mmm yyyy";
  header(os);
  os.autoFilter = { from: "A1", to: "N1" };

  const ps = wb.addWorksheet("Products");
  ps.columns = [{ header: "Product", key: "name", width: 30 }, { header: "Sold", key: "count", width: 8 }, { header: "Sales (before discounts)", key: "amount", width: 22, style: { numFmt: money } }];
  r.topProducts.forEach((p) => ps.addRow(p));
  header(ps);

  const ds = wb.addWorksheet(r.unit === "day" ? "By day" : "By month");
  ds.columns = [
    { header: r.unit === "day" ? "Day" : "Month", key: "label", width: 12 }, { header: "Paid orders", key: "orders", width: 12 },
    { header: "Counter (POS)", key: "counter", width: 14, style: { numFmt: money } }, { header: "Online", key: "online", width: 12, style: { numFmt: money } },
    { header: "Total", key: "total", width: 12, style: { numFmt: money } },
  ];
  r.periods.forEach((p) => ds.addRow({ ...p, total: p.counter + p.online }));
  header(ds);

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="thelawalaa-sales_${range.from}_to_${range.to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
