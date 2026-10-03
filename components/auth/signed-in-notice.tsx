"use client";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_HOME } from "@/lib/role-home";
import { signOutTo } from "@/lib/sign-out";

/**
 * On the sign-in / sign-up pages: if this device is already signed in, say
 * who as — with "Continue" and "Sign out" — instead of a blank form that
 * looks like they're logged out. (Phones get shared; this makes it obvious.)
 */
export default function SignedInNotice({ purpose }: { purpose: "login" | "signup" }) {
  const [who, setWho] = useState<{ name: string; email: string; home: string } | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name, role").eq("id", data.user.id).maybeSingle();
      if (!p || p.role === "accountant") return;
      setWho({ name: p.full_name || data.user.email || "", email: data.user.email ?? "", home: ROLE_HOME[p.role] ?? "/account" });
    }).catch(() => {});
  }, []);
  if (!who) return null;
  return (
    <div className="mb-5 rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-100">
      <p className="flex items-start gap-2 text-sm text-brand-brown">
        <UserRound size={18} className="mt-0.5 shrink-0 text-brand-orange" />
        <span>You&apos;re already signed in as <b>{who.name}</b>{who.email && who.name !== who.email ? <span className="text-stone-500"> ({who.email})</span> : null}.
          {purpose === "signup" ? " Sign out first to create a different account." : ""}</span>
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => window.location.replace(who.home)} className="btn-primary flex-1 !py-2 text-sm">Continue</button>
        <button onClick={() => signOutTo(purpose === "signup" ? "/auth/signup" : "/auth/login")}
          className="flex-1 rounded-full border-2 border-stone-200 py-2 text-sm font-bold text-brand-brown hover:bg-white">Sign out</button>
      </div>
    </div>
  );
}
