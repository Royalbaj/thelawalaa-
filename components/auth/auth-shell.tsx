import Image from "next/image";
import Link from "next/link";
import { Star, Gift, Bike } from "lucide-react";
import heroImage from "@/public/images/hero/thelawalaa-chatpate-momo.webp";

/** Sign-in / sign-up / reset screens: the food on one side, the form on the other. */
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-white">
      {/* Laptops: the photo, with why it's worth signing up */}
      <aside className="relative hidden w-[46%] overflow-hidden bg-[#0e0805] lg:block">
        <Image src={heroImage} alt="" fill priority placeholder="blur" sizes="46vw" className="object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0805] via-[#0e0805]/40 to-[#0e0805]/30" />
        <div className="relative flex h-full flex-col justify-between p-10 text-amber-50">
          <Link href="/" className="font-display text-2xl font-extrabold brand-gradient-text">Thelawalaa</Link>
          <div>
            <p className="font-display text-4xl font-extrabold leading-tight">Hygienic street food,<br />bold flavour.</p>
            <ul className="mt-6 space-y-3 text-sm text-amber-100/90">
              <li className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"><Star size={16} className="text-brand-yellow" /></span> Earn points on every order</li>
              <li className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"><Gift size={16} className="text-brand-orange" /></span> Free drinks as a regular</li>
              <li className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"><Bike size={16} className="text-green-400" /></span> Order ahead and track it live</li>
            </ul>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        {/* Phones: a compact brand bar */}
        <div className="bg-[#0e0805] px-5 py-4 lg:hidden">
          <Link href="/" className="font-display text-xl font-extrabold brand-gradient-text">Thelawalaa</Link>
        </div>
        <div className="flex flex-1 items-start justify-center px-5 py-8 sm:items-center sm:py-12">
          <div className="w-full max-w-md">
            <h1 className="font-display text-3xl font-extrabold text-brand-brown">{title}</h1>
            {subtitle && <p className="mt-2 text-stone-500">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </div>
        <p className="px-5 pb-6 text-center text-xs text-stone-400">
          © {new Date().getFullYear()} Thelawalaa · <Link href="/" className="hover:text-brand-orange">Back to website</Link>
        </p>
      </main>
    </div>
  );
}
