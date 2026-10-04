import Link from "next/link";
import { MapPin, MessageCircle, ChevronRight, BadgeCheck, FileText } from "lucide-react";
import { getVerifiedUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OffersToggle } from "@/components/account/offers-join";
import { DetailsForm, PasswordForm } from "@/components/account/profile-forms";
import SignOutButton from "@/components/account/sign-out-button";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user, profile } = await getVerifiedUser();
  if (!user || !profile) return null;
  const since = new Date(user.created_at).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", month: "long", year: "numeric" });
  const { data: consent } = await supabaseAdmin.from("profiles").select("marketing_opt_in").eq("id", user.id).single();

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-brand-brown">Profile</h1>
        <p className="text-sm text-stone-500">Member since {since}</p>
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-100 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-brand-brown">Your details</h2>
        <DetailsForm fullName={profile.full_name} phone={profile.phone ?? ""} />
        <div className="mt-5 border-t border-stone-100 pt-4">
          <p className="label !mb-0.5">Email</p>
          <p className="flex flex-wrap items-center gap-2 text-stone-700">
            {user.email}
            {user.email_confirmed_at && <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700"><BadgeCheck size={12} /> Verified</span>}
          </p>
          <p className="mt-1 text-xs text-stone-400">Need to change your email? Message us and we&apos;ll do it for you.</p>
        </div>
      </section>

      {profile.role === "customer" && (
        <section id="offers" className="scroll-mt-24 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-100 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-brand-brown">Messages from us</h2>
          <OffersToggle joined={!!consent?.marketing_opt_in} />
        </section>
      )}

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-100 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-brand-brown">Password</h2>
        <PasswordForm email={user.email ?? ""} />
      </section>

      <section className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-100">
        {[
          { href: "/account/addresses", icon: MapPin, title: "Saved addresses", body: "For home delivery" },
          { href: "/whatsapp", icon: MessageCircle, title: "Help & support", body: "Chat with us on WhatsApp" },
          { href: "/terms", icon: FileText, title: "Terms & privacy", body: "Orders, offers, rewards and your data" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 px-5 py-4 transition hover:bg-stone-50">
            <l.icon size={20} strokeWidth={1.75} className="shrink-0 text-brand-brown" />
            <span className="flex-1"><span className="block text-sm font-bold text-brand-brown">{l.title}</span><span className="block text-xs text-stone-500">{l.body}</span></span>
            <ChevronRight size={18} className="text-stone-300" />
          </Link>
        ))}
      </section>

      <SignOutButton />
    </div>
  );
}
