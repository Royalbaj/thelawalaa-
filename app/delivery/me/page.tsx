import Link from "next/link";
import { GraduationCap, ChevronRight, Bike } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import DriverAlerts from "@/components/delivery/driver-alerts";
import SignOutButton from "@/components/account/sign-out-button";

export const dynamic = "force-dynamic";

export default async function DriverMePage() {
  const { user, profile } = await requireRole(["delivery_driver", "super_admin"]);
  const { data: me } = await supabaseAdmin.from("profiles").select("vehicle_type, vehicle_number, phone").eq("id", user.id).single();
  return (
    <div className="space-y-4">
      <section className="flex items-center gap-4 rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange to-brand-red text-white"><Bike size={26} /></span>
        <div className="min-w-0">
          <p className="font-display text-xl font-extrabold">{profile.full_name}</p>
          <p className="text-sm text-white/50">{[me?.vehicle_type, me?.vehicle_number].filter(Boolean).join(" · ") || "Delivery rider"}</p>
          <p className="text-xs text-white/40">{user.email}</p>
        </div>
      </section>

      <DriverAlerts />

      <Link href="/staff" className="flex items-center gap-3 rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10 transition hover:bg-white/10">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-orange-300"><GraduationCap size={20} /></span>
        <span className="flex-1"><span className="block font-bold">Training videos</span><span className="block text-xs text-white/50">Watch the ones the shop gave you</span></span>
        <ChevronRight size={18} className="text-white/30" />
      </Link>

      <div className="rounded-3xl bg-white/[0.06] p-5 text-sm text-white/60 ring-1 ring-white/10">
        <p className="font-bold text-white">Good to know</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Go offline when you finish, so the shop doesn&apos;t give you new deliveries.</li>
          <li>Check the bag against the list before you leave the shop.</li>
          <li>Only hand over the food once the customer gives you their 4-digit code.</li>
        </ul>
      </div>

      <SignOutButton dark />
    </div>
  );
}
