"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";
import { npr } from "@/lib/utils";
import { resetSalesData } from "@/app/actions/system";

export default function ResetSalesData() {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();

  // The route answers with Content-Disposition: attachment, so this downloads
  // the Excel file without leaving the page. It stays listed under Sales archives.
  function downloadExcel(archiveId: string) {
    const a = document.createElement("a");
    a.href = `/admin/archives/${archiveId}/excel`;
    a.click();
  }

  function submit() {
    if (pin.length !== 4) { toast.error("Enter the 4-digit PIN"); return; }
    if (!confirm("This permanently clears all orders, sales and today's counter. A copy is saved and downloaded first. This cannot be undone — continue?")) return;
    start(async () => {
      const r = await resetSalesData(pin);
      if (r?.error) { toast.error(r.error); return; }
      if (r.archive) downloadExcel(r.archive.id);
      toast.success(`Cleared ${r.archive?.order_count ?? 0} orders. Excel file downloaded — it's also saved under Sales archives.`, { duration: 8000 });
      setOpen(false);
      setPin("");
    });
  }

  return (
    <div className="card space-y-3 border border-red-100 p-5">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-brand-red" />
        <div>
          <h3 className="font-display font-bold text-brand-brown">Reset sales data</h3>
          <p className="text-xs text-stone-500">Clears all orders and today&apos;s order counter so you can start fresh on opening day. Products, staff, and settings are untouched. A full copy is saved first and downloaded as an Excel file — you can download it again any time from Sales archives.</p>
        </div>
      </div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-brand-red hover:bg-red-100 transition">
          Reset sales data…
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            type="password"
            inputMode="numeric"
            placeholder="PIN"
            className="input !w-24 text-center tracking-widest"
            autoFocus
          />
          <button disabled={pending} onClick={submit} className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:brightness-110 transition disabled:opacity-50">
            {pending ? "Resetting…" : "Confirm reset"}
          </button>
          <button onClick={() => { setOpen(false); setPin(""); }} className="text-sm font-bold text-stone-400 hover:text-stone-600">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
