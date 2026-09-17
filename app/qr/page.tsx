"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Mail, Facebook, Instagram, Link2 } from "lucide-react";
import TikTokIcon from "@/components/icons/tiktok";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validations/auth";

type SocialLink = { id: string; platform: string; url: string };

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p === "facebook") return Facebook;
  if (p === "instagram") return Instagram;
  if (p === "tiktok") return TikTokIcon;
  return Link2;
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function SocialRow({ links }: { links: SocialLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex justify-center gap-3">
      {links.map((l) => {
        const Icon = platformIcon(l.platform);
        return (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Thelawalaa on ${l.platform}`}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <Icon size={20} />
          </a>
        );
      })}
    </div>
  );
}

export default function QrSignupPage() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const s = strength(pw);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("social_links")
      .select("id, platform, url")
      .order("sort_order")
      .then(({ data }) => setSocialLinks((data ?? []) as SocialLink[]));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    if (fd.password !== fd.confirm) return toast.error("Passwords don't match");
    const parsed = signupSchema.safeParse(fd);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.full_name, phone: parsed.data.phone, signup_source: "qr_poster" },
        emailRedirectTo: `${window.location.origin}/auth/verify`,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  }

  if (sent)
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
        <div className="card max-w-md p-8 text-center">
          <Mail size={40} className="mx-auto text-brand-orange" />
          <h1 className="mt-3 font-display text-2xl font-bold">Check your email</h1>
          <p className="mt-2 text-stone-600">Tap the verification link we just sent to activate your account.</p>
          {socialLinks.length > 0 && (
            <div className="mt-6 border-t border-stone-100 pt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Follow us for updates</p>
              <div className="mt-3">
                <div className="flex justify-center gap-3">
                  {socialLinks.map((l) => {
                    const Icon = platformIcon(l.platform);
                    return (
                      <a
                        key={l.id}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Thelawalaa on ${l.platform}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-brown/10 text-brand-brown transition hover:bg-brand-brown/20"
                      >
                        <Icon size={18} />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-dark px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-gradient-to-br from-brand-red via-brand-orange to-brand-yellow p-6 text-center shadow-xl">
          <p className="font-display text-3xl font-black tracking-tight text-white drop-shadow-sm">Thelawalaa</p>
          <p className="mt-2 font-display text-lg font-bold uppercase tracking-wide text-white">
            Opening Day Special
          </p>
          <p className="mt-1 text-sm font-bold text-white/90">
            Sign up now and follow us to grab exclusive offers first.
          </p>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Follow us & get this offer</p>
            <div className="mt-3">
              <SocialRow links={socialLinks} />
            </div>
          </div>
        </div>

        <div className="card mt-4 w-full p-8">
          <h1 className="text-center font-display text-xl font-bold">Create your account</h1>
          <p className="mt-1 text-center text-sm text-stone-500">
            Sign up to get exclusive offers and order online.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div><label className="label" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required minLength={2} maxLength={100} className="input" /></div>
            <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
            <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" required placeholder="98XXXXXXXX" className="input" /></div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" required className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
              <div className="mt-2 flex gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < s ? ["bg-brand-red","bg-brand-yellow","bg-brand-orange","bg-brand-green"][s - 1] : "bg-stone-200"}`} />
                ))}
              </div>
              <p className="mt-1 text-xs text-stone-500">8+ characters with an uppercase letter, a number and a symbol.</p>
            </div>
            <div><label className="label" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" required className="input" /></div>
            <button disabled={busy} className="btn-primary w-full">{busy ? "Creating…" : "Create account"}</button>
            <p className="text-center text-sm font-bold">Already a member? <Link href="/auth/login" className="text-brand-orange">Sign in</Link></p>
          </form>
        </div>
      </div>
    </div>
  );
}
