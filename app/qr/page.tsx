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

        <div className="mt-3 flex items-center justify-center gap-3">

          <!-- Facebook -->
          <a 
            href="https://www.facebook.com/share/19i61to1PT/?mibextid=wwXIfr" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#1877F2] shadow-md transition-transform hover:scale-110"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              <path d="M14 8h3V4h-3c-3.31 0-5 1.69-5 5v3H6v4h3v8h4v-8h3l1-4h-4V9c0-.67.33-1 1-1z"/>
            </svg>
          </a>

          <!-- Instagram -->
          <a 
            href="https://www.instagram.com/officialthelawalaa?stkn=Yzlod3Z0NzE5Z283" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#E4405F] shadow-md transition-transform hover:scale-110"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
            </svg>
          </a>

          <!-- TikTok -->
          <a 
            href="https://www.tiktok.com/@officialthelawalaa?_r=1&_t=ZT-99r6zeIKbeA" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="TikTok"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-md transition-transform hover:scale-110"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              <path d="M16.6 5.82A4.75 4.75 0 0 1 15.35 3h-3.4v11.2a2.82 2.82 0 1 1-2-2.7V8.05a6.2 6.2 0 1 0 5.4 6.15V8.45a8.1 8.1 0 0 0 4.75 1.52V6.58a4.73 4.73 0 0 1-3.5-.76z"/>
            </svg>
          </a>

        </div>
      </div> 
    </div>
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
