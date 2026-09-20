"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function StaffHeader({ backHref }: { backHref: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-orange-900/20 bg-brand-dark px-4 py-3 text-white">
      <Link href={backHref} className="flex items-center gap-1.5 text-sm font-bold text-white/80 hover:text-white">
        <ArrowLeft size={16} /> Back
      </Link>
      <span className="font-display font-bold brand-gradient-text">Staff Portal</span>
      <button
        onClick={async () => { await createClient().auth.signOut(); router.push("/auth/login"); router.refresh(); }}
        aria-label="Sign out"
        className="flex items-center gap-1.5 text-sm font-bold text-white/60 hover:text-white"
      >
        <LogOut size={16} />
      </button>
    </header>
  );
}
