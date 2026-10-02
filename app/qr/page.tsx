"use client";
import { ChevronDown } from "lucide-react";
import SignupForm from "@/components/auth/signup-form";
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

export default function QrSignupPage() {
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
          <div className="mt-6">
            <SignupForm
              source="qr_poster"
              afterSent={
                <div className="mt-6 border-t border-stone-100 pt-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Follow us for updates</p>
                  <ChevronDown size={18} className="mx-auto mt-1 animate-bounce text-stone-300" aria-hidden />
                  <div className="mt-1"><SocialBadges /></div>
                  <p className="mt-2 text-xs font-bold text-stone-400">Tap an icon to open our page</p>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
