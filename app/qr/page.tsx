"use client";
import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Mail, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validations/auth";
import { FacebookLogo, InstagramLogo, TikTokLogo } from "@/components/icons/social-logos";

const SOCIALS = [
  { platform: "Facebook", href: "https://www.facebook.com/share/19i61to1PT/?mibextid=wwXIfr", Icon: FacebookLogo },
  { platform: "Instagram", href: "https://www.instagram.com/officialthelawalaa?stkn=Yzlod3Z0NzE5Z283", Icon: InstagramLogo },
  { platform: "TikTok", href: "https://www.tiktok.com/@officialthelawalaa?_r=1&_t=ZT-99r6zeIKbeA", Icon: TikTokLogo },
];

function SocialBadges() {
  return (
    <div className="flex items-center justify-center gap-3">
      {SOCIALS.map(({ platform, href, Icon }) => (
        <a
          key={platform}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={platform}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md transition-transform hover:scale-110"
        >
          <Icon size={22} />
        </a>
      ))}
    </div>
  );
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function QrSignupPage() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const s = strength(pw);

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
          <div className="mt-6 border-t border-stone-100 pt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Follow us for updates</p>
            <ChevronDown size={18} className="mx-auto mt-1 animate-bounce text-stone-300" aria-hidden />
            <div className="mt-1">
              <SocialBadges />
            </div>
            <p className="mt-2 text-xs font-bold text-stone-400">Tap an icon to open our page</p>
          </div>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-dark px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-gradient-to-br from-brand-red via-brand-orange to-brand-yellow p-6 text-center shadow-xl">
          <p className="font-display text-3xl font-black tracking-tight text-white drop-shadow-sm">Thelawalaa</p>
          <p className="mt-1 font-display text-sm font-bold uppercase tracking-widest text-white/90">
            Opening Day Special
          </p>

          <div className="mx-auto mt-4 flex w-fit items-center gap-4 rounded-2xl bg-white px-6 py-4 shadow-lg">
            <p className="font-display text-5xl font-black leading-none text-brand-red">
              Rs&nbsp;11
            </p>
            <div className="h-11 w-px bg-stone-200" />
            <p className="text-left font-display text-lg font-black uppercase leading-tight text-brand-brown">
              1 Plate<br />Momo
            </p>
          </div>

          <p className="mx-auto mt-4 max-w-xs font-display text-base font-bold leading-snug text-white drop-shadow-sm">
            Follow us to unlock this offer — and several more!
          </p>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Follow us & get this offer</p>
            <ChevronDown size={20} className="mx-auto mt-1 animate-bounce text-white/80" aria-hidden />
            <div className="mt-1">
              <SocialBadges />
            </div>
            <p className="mt-2 text-xs font-bold text-white/70">Tap an icon to open our page</p>
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
