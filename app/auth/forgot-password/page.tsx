"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-center font-display text-2xl font-bold">Reset your password</h1>
        {sent ? (
          <p className="mt-4 text-center text-stone-600">If that email exists, a reset link is on its way. 📬</p>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const email = String(new FormData(e.currentTarget).get("email"));
              await createClient().auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/invite`,
              });
              // Same response whether or not the account exists — no user enumeration.
              setSent(true);
              toast.success("Check your inbox");
            }}
          >
            <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
            <button className="btn-primary w-full">Send reset link</button>
          </form>
        )}
      </div>
    </div>
  );
}
