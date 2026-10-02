"use client";
import { Printer } from "lucide-react";

/** Print, or "Save as PDF" from the print dialog. */
export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 font-bold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50">
      <Printer size={15} /> Print / PDF
    </button>
  );
}
