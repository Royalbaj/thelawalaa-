"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      <h1 className="font-display text-xl font-bold text-brand-brown">My Profile</h1>

      <div className="rounded-2xl bg-white border border-stone-100 p-5 space-y-4">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-brand-cream mx-auto flex items-center justify-center text-3xl">👤</div>
          <p className="mt-2 font-bold text-brand-brown">Your Account</p>
          <p className="text-xs text-stone-400">Manage your profile settings</p>
        </div>

        <div className="space-y-3">
          {[
            { icon: "📍", label: "Saved Addresses", desc: "Manage delivery addresses" },
            { icon: "🔔", label: "Notifications", desc: "Order updates & offers" },
            { icon: "🔒", label: "Privacy", desc: "Data & security settings" },
            { icon: "❓", label: "Help & Support", desc: "Get help with orders" },
          ].map((item) => (
            <button key={item.label} className="w-full flex items-center gap-3 rounded-xl bg-stone-50 p-3 hover:bg-stone-100 transition text-left">
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="text-sm font-bold text-brand-brown">{item.label}</p>
                <p className="text-[10px] text-stone-400">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full rounded-2xl bg-red-50 border border-red-200 text-red-600 py-3 text-sm font-bold hover:bg-red-100 transition"
      >
        Sign Out
      </button>

      <p className="text-center text-[10px] text-stone-300">Thelawalaa v2.0 · Made with 🧡 in Nepal</p>
    </div>
  );
}
