"use client";
import { LogOut } from "lucide-react";
import { signOutHere } from "@/lib/sign-out";
import { cn } from "@/lib/utils";

export default function SignOutButton({ dark = false }: { dark?: boolean }) {
  return (
    <button onClick={() => signOutHere()}
      className={cn("flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition",
        dark ? "bg-red-500/10 text-red-300 ring-1 ring-red-500/25 hover:bg-red-500/20" : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100")}>
      <LogOut size={16} /> Sign out
    </button>
  );
}
