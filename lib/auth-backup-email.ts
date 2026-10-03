import { createClient } from "@/lib/supabase/client";

// When our own email service can't send (the server action says `fallback`),
// the page asks Supabase to send its backup email instead. This reports
// back honestly: a rate limit or a broken mailer is shown to the person —
// but any answer that could only mean "this account exists / is confirmed"
// is treated as sent, so the page never reveals who has an account.
export type BackupResult = { ok: true } | { ok: false; message: string };

export async function sendBackupEmail(kind: "signup" | "reset", email: string): Promise<BackupResult> {
  const supabase = createClient();
  const origin = window.location.origin;
  const { error } = kind === "signup"
    ? await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin}/auth/verify` } })
    : await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/reset-password` });
  if (!error) return { ok: true };
  const msg = (error.message ?? "").toLowerCase();
  const code = (error as { code?: string }).code ?? "";
  if (error.status === 429 || code.includes("rate_limit") || msg.includes("rate limit") || msg.includes("security purposes")) {
    return { ok: false, message: "We've just sent a few emails — please wait a minute or two, then try again." };
  }
  if ((error.status ?? 0) >= 500 || msg.includes("error sending") || msg.includes("not authorized")) {
    return { ok: false, message: "We couldn't send the email right now. Please try again shortly — or message us on WhatsApp and we'll help." };
  }
  return { ok: true };
}
