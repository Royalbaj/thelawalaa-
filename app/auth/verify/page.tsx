"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { completeSignup } from "@/app/actions/auth";
import AuthShell from "@/components/auth/auth-shell";

// Landing page for Supabase's BACKUP confirmation email (only used when our
// own email service couldn't send). Supabase has already confirmed the
// address before redirecting here. If the link also signed this browser in,
// send the welcome email and sign it straight out again — confirming never
// leaves a device logged in; they sign in themselves.
export default function VerifyPage() {
  const [state, setState] = useState<"checking" | "in" | "signin" | "failed">("checking");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    if (hash.get("error") || query.get("error")) { setState("failed"); return; }
    const supabase = createClient();
    let done = false;
    const enter = async () => {
      if (done) return;
      done = true;
      await completeSignup().catch(() => null);
      await supabase.auth.signOut({ scope: "local" }).catch(() => null);
      setState("signin");
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { if (session) enter(); });
    supabase.auth.getSession().then(({ data }) => { if (data.session) enter(); });
    const t = setTimeout(() => { if (!done) setState("signin"); }, 3000);
    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  return (
    <AuthShell title={state === "failed" ? "This link has expired" : "Email confirmed"}>
      <div className="text-center">
        {state === "failed" ? (
          <>
            <XCircle size={44} className="mx-auto text-brand-red" />
            <p className="mt-3 text-stone-600">Sign in and we&apos;ll offer to send you a fresh link.</p>
            <Link href="/auth/login" className="btn-primary mt-6">Sign in</Link>
          </>
        ) : (
          <>
            <CheckCircle2 size={44} className="mx-auto text-brand-green" />
            <p className="mt-3 text-stone-600">{state === "checking" ? "Just a moment…" : "Your account is ready — sign in with your email and password to start ordering."}</p>
            {state === "signin" && <Link href="/auth/login?verified=1" className="btn-primary mt-6">Sign in</Link>}
          </>
        )}
      </div>
    </AuthShell>
  );
}
