import "server-only";
import ExcelJS from "exceljs";
import { prettyDate, nepalToday, type Range } from "@/lib/dates";
import { totals, byCategory, byMethod, byPeriod, METHOD_LABELS, KIND_LABELS, type Category, type Entry, type Kind } from "@/lib/ledger";

// The money-book downloads, built from entries already loaded and checked
// by the caller (app/export/route.ts).
export type ExportInput = {
  range: Range; categories: Category[]; entries: Entry[];
  balanceBefore: number; filter: { kind?: Kind; categoryId?: string; q?: string; missingBill?: boolean };
};

export const exportFileBase = (r: Range) => `thelawalaa-accounts_${r.from}_to_${r.to}`;

export function buildCsv({ categories, entries }: ExportInput): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const cell = (v: string | number) => {
    const s = String(v);
    // Quote when needed; a leading = + - @ would run as a formula in Excel.
    const safe = /^[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [...entries].reverse();
  return "\uFEFF" + [
    ["Date", "Type", "Category", "Description", "Paid by", "Money in", "Money out", "Bill", "Entered by"].join(","),
    ...rows.map((e) => [
      e.occurred_on, KIND_LABELS[e.kind], catName.get(e.category_id) ?? "", e.description ?? "", METHOD_LABELS[e.method],
      e.kind === "in" ? e.amount : "", e.kind === "out" ? e.amount : "", e.bill_path ? "Yes" : "No", e.creator?.full_name ?? "",
    ].map(cell).join(",")),
  ].join("\r\n");
}

export async function buildWorkbook({ range, categories, entries, balanceBefore, filter }: ExportInput): Promise<ArrayBuffer> {
  const { kind, categoryId, q } = filter;
  const before = { balance: balanceBefore };
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const rows = [...entries].reverse(); // oldest first reads better in a sheet
  const t = totals(entries);
  const filtered = Boolean(kind || categoryId || q || filter.missingBill);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Thelawalaa Accounts";
  wb.created = new Date();
  const money = '"Rs "#,##0.00';
  const header = (ws: ExcelJS.Worksheet) => {
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF78350F" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  // Summary
  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ width: 34 }, { width: 22 }];
  sum.addRows([
    ["Thelawalaa — money book"],
    ["Period", `${prettyDate(range.from)} – ${prettyDate(range.to)}`],
    ["Downloaded", prettyDate(nepalToday())],
    ...(filtered ? [["Filter", [kind && KIND_LABELS[kind], categoryId && catName.get(categoryId), q && `"${q}"`, filter.missingBill && "No bill attached"].filter(Boolean).join(" · ")]] : []),
    [],
    ...(!filtered ? [["Balance at start of period", before.balance]] : []),
    ["Money in", t.moneyIn],
    ["Money out", t.moneyOut],
    ["Net (in − out)", t.net],
    ...(!filtered ? [["Balance at end of period", before.balance + t.net]] : []),
    ["Number of entries", t.count],
  ]);
  sum.getRow(1).font = { bold: true, size: 14 };
  sum.eachRow((row) => { const c = row.getCell(2); if (typeof c.value === "number" && row.getCell(1).value !== "Number of entries") c.numFmt = money; });
  for (const k of ["in", "out"] as Kind[]) {
    const slices = byCategory(entries, categories, k);
    if (!slices.length) continue;
    sum.addRow([]);
    sum.addRow([`${KIND_LABELS[k]} by category`]).font = { bold: true };
    slices.forEach((s) => { const r = sum.addRow([s.name, s.amount]); r.getCell(2).numFmt = money; });
    sum.addRow([]);
    sum.addRow([`${KIND_LABELS[k]} by payment method`]).font = { bold: true };
    byMethod(entries, k).forEach((s) => { const r = sum.addRow([s.name, s.amount]); r.getCell(2).numFmt = money; });
  }

  // Entries
  const ws = wb.addWorksheet("Entries");
  ws.columns = [
    { header: "Date", key: "date", width: 12 }, { header: "Type", key: "type", width: 11 },
    { header: "Category", key: "cat", width: 22 }, { header: "Description", key: "desc", width: 40 },
    { header: "Paid by", key: "method", width: 12 }, { header: "Money in", key: "in", width: 14, style: { numFmt: money } },
    { header: "Money out", key: "out", width: 14, style: { numFmt: money } }, { header: "Bill", key: "bill", width: 7 },
    { header: "Entered by", key: "by", width: 16 },
  ];
  rows.forEach((e) => ws.addRow({
    date: new Date(`${e.occurred_on}T00:00:00Z`), type: KIND_LABELS[e.kind], cat: catName.get(e.category_id) ?? "",
    desc: e.description ?? "", method: METHOD_LABELS[e.method],
    in: e.kind === "in" ? e.amount : null, out: e.kind === "out" ? e.amount : null,
    bill: e.bill_path ? "Yes" : "No", by: e.creator?.full_name ?? "",
  }));
  ws.getColumn("date").numFmt = "dd mmm yyyy";
  const totalRow = ws.addRow({ desc: "Total", in: t.moneyIn, out: t.moneyOut });
  totalRow.font = { bold: true };
  header(ws);
  ws.autoFilter = { from: "A1", to: "I1" };

  // By day / month
  const { unit, buckets } = byPeriod(entries, range.from, range.to);
  const bp = wb.addWorksheet(unit === "day" ? "By day" : "By month");
  bp.columns = [
    { header: unit === "day" ? "Day" : "Month", key: "k", width: 14 },
    { header: "Money in", key: "in", width: 14, style: { numFmt: money } },
    { header: "Money out", key: "out", width: 14, style: { numFmt: money } },
    { header: "Net", key: "net", width: 14, style: { numFmt: money } },
  ];
  buckets.forEach((b) => bp.addRow({ k: b.label, in: b.in, out: b.out, net: b.in - b.out }));
  header(bp);

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
