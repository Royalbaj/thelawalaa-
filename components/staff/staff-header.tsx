"use client";
import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { signOutHere } from "@/lib/sign-out";
import BrandLogo from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function StaffHeader({ backHref }: { backHref: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-orange-900/20 bg-brand-dark px-4 py-3 text-white">
      <Link href={backHref} className="flex items-center gap-1.5 text-sm font-bold text-white/80 hover:text-white">
        <ArrowLeft size={16} /> Back
      </Link>
      <BrandLogo size="sm" tone="dark" label="Training" />
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <button
          onClick={signOutHere}
          aria-label="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-red-500/20 hover:text-red-300"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
