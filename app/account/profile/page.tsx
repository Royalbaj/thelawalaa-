"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, MapPin, MessageCircle, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function handleSignOut() {
    startTransition(async () => {
      await createClient().auth.signOut();
      router.push("/auth/login");
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      <h1 className="font-display text-xl font-bold text-brand-brown">My Profile</h1>

      <div className="rounded-2xl bg-white border border-stone-100 p-5 space-y-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-cream text-brand-orange"><User size={28} /></div>
          <p className="mt-2 font-bold text-brand-brown">Your Account</p>
          <p className="text-xs text-stone-400">Manage your profile settings</p>
        </div>

        <div className="space-y-3">
          <Link href="/account/addresses" className="w-full flex items-center gap-3 rounded-xl bg-stone-50 p-3 hover:bg-stone-100 transition text-left">
            <MapPin size={20} className="text-brand-orange" />
            <div>
              <p className="text-sm font-bold text-brand-brown">Saved Addresses</p>
              <p className="text-[10px] text-stone-400">Manage delivery addresses</p>
            </div>
          </Link>
          <a href="https://wa.me/9779801011111" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 rounded-xl bg-stone-50 p-3 hover:bg-stone-100 transition text-left">
            <MessageCircle size={20} className="text-brand-orange" />
            <div>
              <p className="text-sm font-bold text-brand-brown">Help &amp; Support</p>
              <p className="text-[10px] text-stone-400">Chat with us on WhatsApp</p>
            </div>
          </a>
        </div>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-red-50 border border-red-200 text-red-600 py-3 text-sm font-bold hover:bg-red-100 transition"
      >
        <LogOut size={16} /> Sign Out
      </button>

      <p className="text-center text-[10px] text-stone-300">Thelawalaa · Made in Nepal</p>
    </div>
  );
}
