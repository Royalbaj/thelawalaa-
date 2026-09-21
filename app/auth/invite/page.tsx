"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema } from "@/lib/validations/auth";
import { ROLE_HOME } from "@/lib/role-home";

// Staff land here from OUR OWN invite email (app/actions/staff.ts), not
// from Supabase's raw /auth/v1/verify link. The token_hash in the URL
// is only consumed inside acceptInvite()'s onClick below — never on
// page load — so an email security scanner prefetching this page just
// sees an inert "Accept invite" button and can't burn the one-time
// token before the real person clicks it.
function InviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function acceptInvite() {
    if (!tokenHash) return toast.error("This link is missing its invite token — ask your admin to resend it");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    setBusy(false);
    if (error) return toast.error("This invite link is no longer valid — ask your admin to resend it from Staff & Users");
    setAccepted(true);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    if (fd.password !== fd.confirm) return toast.error("Passwords don't match");
    const parsed = passwordSchema.safeParse(fd.password);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    if (error) { setBusy(false); return toast.error("Something went wrong setting your password — try again"); }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ invite_accepted_at: new Date().toISOString() }).eq("id", user.id);
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      router.push((p?.role && ROLE_HOME[p.role]) || "/account");
      router.refresh();
    }
  }

  if (!accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
        <div className="card w-full max-w-md p-8">
          <h1 className="text-center font-display text-2xl font-bold">You're invited</h1>
          <p className="mt-2 text-center text-sm text-stone-600">Join the Thelawalaa team — accept your invite to get started.</p>
          <button onClick={acceptInvite} disabled={busy || !tokenHash} className="btn-primary mt-6 w-full">
            {busy ? "Checking…" : "Accept invite"}
          </button>
          {!tokenHash && (
            <p className="mt-3 text-center text-xs text-brand-red">
              This link is missing its invite token — open it from the original email, or ask your admin to resend it.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-center font-display text-2xl font-bold">Welcome to the team</h1>
        <p className="mt-2 text-center text-sm text-stone-600">Set a password to activate your staff account.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" required className="input" /></div>
          <div><label className="label" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" required className="input" /></div>
          <button disabled={busy} className="btn-primary w-full">{busy ? "Saving…" : "Activate account"}</button>
        </form>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteForm />
    </Suspense>
  );
}
