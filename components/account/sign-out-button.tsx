"use client";
import { LogOut } from "lucide-react";
import { signOutHere } from "@/lib/sign-out";

export default function SignOutButton() {
  return (
    <button onClick={() => signOutHere()}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition hover:bg-red-100">
      <LogOut size={16} /> Sign out
    </button>
  );
}
