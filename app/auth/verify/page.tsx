"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

export default function VerifyPage() {
  // Supabase redirects back here on both success AND failure (expired/used
  // link) — the outcome is only in the URL hash, never in the path itself.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    if (hash.get("error") || query.get("error")) setFailed(true);
  }, []);

  if (failed)
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
        <div className="card max-w-md p-8 text-center">
          <XCircle size={40} className="mx-auto text-brand-red" />
          <h1 className="mt-3 font-display text-2xl font-bold">Link expired</h1>
          <p className="mt-2 text-stone-600">This verification link is no longer valid. Sign in and request a new one, or contact us if it keeps happening.</p>
          <Link href="/auth/login" className="btn-primary mt-6">Back to sign in</Link>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card max-w-md p-8 text-center">
        <CheckCircle2 size={40} className="mx-auto text-brand-green" />
        <h1 className="mt-3 font-display text-2xl font-bold">Email verified</h1>
        <p className="mt-2 text-stone-600">Your account is ready. Time for some chatpate.</p>
        <Link href="/auth/login" className="btn-primary mt-6">Sign in</Link>
      </div>
    </div>
  );
}
